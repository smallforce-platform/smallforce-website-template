import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const template = join(root, "templates/tanstack");
let directory;
let child;
let origin;
let logs = "";

before(async () => {
  assert.ok(process.env.SMALLFORCE_CELLD_BIN, "Set SMALLFORCE_CELLD_BIN to the SmallForce Celld binary.");
  const config = JSON.parse(await readFile(join(template, "smallforce.json"), "utf8"));
  const output = join(template, config.build.outputDirectory);
  const entry = join(output, config.build.entrypoint);
  const moduleRoot = dirname(entry);
  const modules = {};
  for (const name of await readdir(moduleRoot, { recursive: true })) {
    if (/\.(m?js)$/.test(name)) {
      modules[name.replaceAll("\\", "/")] = await readFile(join(moduleRoot, name), "utf8");
    }
  }
  const mainModule = basename(entry);
  assert.ok(modules[mainModule], "Build the TanStack template before running this test.");
  directory = await mkdtemp(join(tmpdir(), "smallforce-tanstack-runtime-"));
  // Celld's native asset uploader rejects Wrangler's ignore file. SmallForce
  // serves release objects directly, so that metadata is unused at runtime.
  await cp(join(output, config.build.assetsDirectory), join(directory, "client"), {
    recursive: true,
    filter: (path) => basename(path) !== ".assetsignore",
  });

  // Load the unchanged module graph as a Dynamic Worker, as the SmallForce
  // host does. Keep asset routing inside the application's custom entrypoint.
  await writeFile(join(directory, "host.js"), `
import { WorkerEntrypoint } from "cloudflare:workers";
export class TemplateAssets extends WorkerEntrypoint {
  fetch(request) { return this.env.ASSETS.fetch(request); }
}
const code = ${JSON.stringify({
    mainModule,
    modules,
    compatibilityDate: config.compatibilityDate,
    compatibilityFlags: config.compatibilityFlags,
  })};
export default {
  fetch(request, env, ctx) {
    const worker = env.LOADER.get("tanstack-template-test", () => ({
      ...code,
      env: { ASSETS: ctx.exports.TemplateAssets() },
    }));
    return worker.getEntrypoint().fetch(request);
  },
};
`);
  const configPath = join(directory, "wrangler.json");
  await writeFile(configPath, JSON.stringify({
    name: "tanstack-template-test",
    main: "host.js",
    no_bundle: true,
    compatibility_date: config.compatibilityDate,
    worker_loaders: [{ binding: "LOADER" }],
    assets: {
      directory: "client",
      binding: "ASSETS",
      run_worker_first: true,
    },
  }));

  const port = await reservePort();
  origin = `http://127.0.0.1:${port}`;
  child = spawn(process.env.SMALLFORCE_CELLD_BIN, [
    "dev", configPath, "--host", "127.0.0.1", "--port", String(port), "--logs",
  ], {
    cwd: directory,
    env: { ...process.env, CELLD_CPU_BUDGET_MS: "1000", NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (data) => { logs = (logs + data).slice(-32_000); });
  child.stderr.on("data", (data) => { logs = (logs + data).slice(-32_000); });
  let spawnError;
  child.on("error", (error) => { spawnError = error; });

  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    assert.equal(child.exitCode, null, logs);
    try {
      const response = await fetch(`${origin}/.well-known/celld/health`, {
        signal: AbortSignal.timeout(1000),
      });
      await response.body?.cancel();
      if (response.ok) return;
    } catch {
      // The supervised runtime may not have opened its port yet.
    }
    await delay(100);
  }
  assert.fail(`Celld did not become ready.\n${logs}`);
}, { timeout: 30_000 });

after(async () => {
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, "exit");
    child.kill("SIGTERM");
    const forceStop = setTimeout(() => child.kill("SIGKILL"), 5000);
    try { await stopped; } finally { clearTimeout(forceStop); }
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("the built Dynamic Worker renders the workspace on Celld", async () => {
  const response = await request("/");
  const html = await response.text();
  assert.equal(response.status, 200, `${html}\n${logs}`);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(html, /Build the first workflow/);
  assert.match(html, /<title>Application<\/title>/);
});

test("the Worker serves emitted browser assets with GET and HEAD", async () => {
  const page = await request("/");
  assert.equal(page.status, 200);
  const html = await page.text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map((match) => match[1]))];
  assert.ok(assets.some((asset) => asset.endsWith(".js")), "SSR must link client JavaScript.");
  assert.ok(assets.some((asset) => asset.endsWith(".css")), "SSR must link the stylesheet.");
  for (const asset of assets) {
    const response = await request(asset);
    assert.equal(response.status, 200, asset);
    assert.doesNotMatch(response.headers.get("content-type") ?? "", /text\/html/);
    const expected = await readFile(join(template, "dist/client", asset));
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected, asset);
    const head = await request(asset, { method: "HEAD" });
    assert.equal(head.status, 200, asset);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
  }
});

test("unknown pages and missing assets preserve the router's 404 response", async () => {
  for (const path of ["/missing-page", "/assets/missing.js"]) {
    const response = await request(path);
    assert.equal(response.status, 404, path);
    assert.match(await response.text(), /Page not found/);
  }
});

test("HEAD requests render without a response body", async () => {
  const response = await request("/", { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
});

function request(path, options = {}) {
  return fetch(new URL(path, origin), { ...options, signal: AbortSignal.timeout(10_000) });
}

async function reservePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const closed = once(server, "close");
  server.close();
  await closed;
  return port;
}
