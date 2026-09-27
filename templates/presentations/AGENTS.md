# SmallForce OpenSlide presentation guide

Create a finished presentation for the customer's topic using pinned OpenSlide 2.0.
Read `.agents/skills/create-presentation/SKILL.md` for the SmallForce workflow and
`.agents/skills/slide-authoring/SKILL.md` for the official React slide contract.
The same skills are available in the OS global bootstrap; use either copy.

Author decks in `slides/<id>/index.tsx`, reusable themes in `themes/`, and media
in `assets/`. Replace the starter content. Inspect every page and exported file.
Use the official create-slide, apply-comments and create-theme skills as needed.

Share the authenticated editor with `smallforce app editor --deck <id> --json`.
Invite direct edits or comments on slides/elements. When asked, apply comments
and return the same URL. Comments do not automatically trigger an agent. All
members of the owning organization may edit; coordinate saves to avoid conflicts.

Once the user approves the saved deck, stop the editor, run tests/typecheck,
and publish with `smallforce app deploy --environment production --json`.
Verify the returned production URL before reporting it live. The editor runs
in the customer's OS; the compiled published presentation runs on Celld.

Preserve `scripts/build.mjs`, `scripts/build-slides.mjs`, `worker/entry.mjs`,
and the normalized build paths in `smallforce.json`: `dist/client` assets plus
`dist/worker/entry.mjs`. The build uses a reviewed-source snapshot, excludes .env
loading, and aborts if source changes during compilation. Managed editing uses
fixed slides/themes/assets paths; project Vite/server configuration is not loaded.

Never expose an unprotected dev server or put platform/provider credentials in
source or assets. Do not add anonymous endpoints that call env.AI or
 env.INTEGRATIONS. Presentation authoring and export do not require runtime
provider access. SmallForce manages publication; do not add vendor hosting config.
