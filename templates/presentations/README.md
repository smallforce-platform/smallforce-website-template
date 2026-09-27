# SmallForce presentations

OpenSlide 2.0 provides React slides, direct editing, slide/element comments,
speaker notes and editable PowerPoint/PDF export from the browser.

```sh
bun install --frozen-lockfile
bun run dev                           # local authoring only
smallforce app editor --deck getting-started --json
bun run test
bun run typecheck
smallforce app deploy --environment production --json
```

The authenticated editor is served through SmallForce and starts the project's
managed OS process on first access. Organization members can edit. Browser closure
keeps it running; `smallforce app editor stop` or an OS restart stops it. Source
files persist. Agent-applied comments require asking the agent to process them.

Approve the saved deck before publication. The build snapshots slides/themes/assets,
compiles to `dist/client`, adds the Celld Worker at `dist/worker/entry.mjs`, and
aborts if source changes during the build. Ordinary `app deploy` targets Preview;
`--environment production` also promotes and waits for the same release in Production.

Read AGENTS.md and `.agents/skills/create-presentation/SKILL.md`. Official OpenSlide
skills are copied unchanged from pinned @open-slide/core@2.0.0; `skills-lock.json`
records their hashes. The platform's `scripts/sync-openslide-skills.mjs` maintains
both global and template copies. See OPENSLIDE-LICENSE for the upstream MIT license.
