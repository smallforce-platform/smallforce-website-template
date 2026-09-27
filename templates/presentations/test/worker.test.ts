import { describe, expect, it } from "bun:test";

import worker from "../worker/entry.mjs";

describe("presentation Worker adapter", () => {
  it("serves the OpenSlide application at the root", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/"),
      {
        ASSETS: {
          fetch: () => Promise.resolve(new Response("open-slide")),
        },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("open-slide");
  });

  it("uses the OpenSlide index for client-side routes", async () => {
    const requestedPaths: string[] = [];
    const response = await worker.fetch(
      new Request("https://example.test/s/quarterly-review"),
      {
        ASSETS: {
          async fetch(request: Request) {
            const pathname = new URL(request.url).pathname;
            requestedPaths.push(pathname);
            return pathname === "/index.html"
              ? new Response("open-slide")
              : new Response("missing", { status: 404 });
          },
        },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("open-slide");
    expect(requestedPaths).toEqual(["/s/quarterly-review", "/index.html"]);
  });

  it("does not rewrite failed mutation requests", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/missing", { method: "POST" }),
      {
        ASSETS: {
          fetch: () => Promise.resolve(new Response("missing", { status: 404 })),
        },
      },
    );

    expect(response.status).toBe(404);
  });
});
