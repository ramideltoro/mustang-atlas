# Mustang Atlas

A searchable, independent Mustang workshop library. The interface combines structured service references, original illustrations and a shared component glossary with an expanding plain-language teaching layer.

## Run locally

Use Node 24 or newer.

```sh
npm ci
npm run ingest -- --source /absolute/path/to/2015-Mustang-Service-Manual
PORT=3186 npm start
# In a second terminal:
npm run dev
```

The supplied manual folder is a structured offline export containing workshop HTML/PDFs, connector records, wiring diagrams and torque-adapter references. It is not committed to Git. Generated content, the search database, original PDFs and extracted media live in `data/`.

```sh
npm test
npm run build
node scripts/audit-catalog.mjs
```

## Content model

The catalog preserves the source hierarchy, engine context, step order, diagnostic branches, safety notices, tables and illustration positions. All diagrams remain source assets; the site does not import the manual's page styling or execute its scripts. Search uses SQLite FTS5 and glossary aliases. See [API documentation](docs/API.md) for the versioned, read-only API used by the web interface and future mobile clients.

Teaching guides are authored separately, linked to a hash of their exact source content. A guide is accepted only when every editable source block is covered. Part numbers, pin assignments, numerical specifications and original media stay traceable to the reference. The Atlas reader clearly identifies references whose prose is still original; it does not imply the entire manual has already been rewritten.

`content/glossary.json`, `content/systems.json` and curated `content/guides/` are tracked editorial content. Generated guides are in `data/guides/`; curated guides take precedence. Definitions are shared rather than duplicated in articles.

## Codex conversion

The finite conversion worker uses the locally signed-in Codex CLI. It does not call the OpenAI API or use model API keys. No AI provider is used by the deployed web application.

```sh
node scripts/rewrite.mjs --concurrency 3 --batch-size 6
node scripts/sync-guides.mjs --watch
```

Large procedures are processed in chunks but become visible only after complete coverage. Validation rejects missing blocks, dropped or invented numerical values, changed units, and missing tool identifiers. The worker supplies original illustrations and scoped glossary context with each writing batch. These checks are not proof of technical correctness or a human review. Failed or ambiguous guides stay unpublished for review. Progress and errors are retained locally in `data/rewrite-progress.json` and `data/rewrite/state.json`; Codex job logs are never deployed.

Create `data/rewrite/stop-after-current` to stop after current batches. Remove it before resuming. A normal stop preserves accepted chunks. The publisher copies only generated guide JSON and progress, and exits when the worker exits.

### Topic introductions

The separate topic-context pass teaches what each subject is, how it works, and why its reference matters. It does not replace the full procedure rewrite. Connector records and wiring sheets receive individual explanations; shared part introductions retain engine applicability, and broad system jobs keep distinct variants and operation phases.

```sh
node scripts/author-topic-contexts.mjs --concurrency 3 --batch-size 48
node scripts/sync-contexts.mjs --watch
node scripts/audit-contexts.mjs
```

Authoring uses the signed-in Codex CLI and supplied source excerpts. Accepted explanations are tracked in `content/topic-contexts.json`; reviewed corrections in `content/context-overrides.json` take precedence on every publication. Checkpoints under `work/topic-context-jobs/accepted/` are bound to the exact evidence and full source hashes. Progress, job evidence and logs stay under `work/` and are not deployed. The publisher validates a snapshot before atomically replacing the live content file.

Create `work/topic-context-jobs/stop-after-current` to drain active batches before restarting. Remove it to resume. If a controller exits after Codex writes its result but before checkpointing it, stop the worker and run `node scripts/recover-context-jobs.mjs` to preview recovery, then add `--apply` to restore eligible missing checkpoints. Run recovery before starting a new plan; changed evidence, source hashes, group IDs, or unsupported references are rejected. Structural acceptance is not a human technical review. The coverage audit must report every document before the introduction pass is considered complete.

See [deployment and operations](docs/DEPLOYMENT.md).

## Original image quality

The reader uses verified, unresized Ford illustrations when available, with a shared image mapping for documents and glossary entries. Small tool previews remain compact; the image viewer offers Fit, true 100% size, and scrollable zoom. Vector diagrams remain scalable. See the image recovery workflow in [deployment and operations](docs/DEPLOYMENT.md).
