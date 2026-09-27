export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json(
        { ok: true },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;
    await response.body?.cancel();

    if (request.method !== "GET" && request.method !== "HEAD") {
      return response;
    }

    // OpenSlide is a client-side application. Unknown presentation routes load
    // its index so presenter, overview, export, and history routes resolve.
    return env.ASSETS.fetch(
      new Request(new URL("/index.html", request.url), request),
    );
  },
};
