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
node scripts/audit-public-catalog.mjs
```

## Content model

The catalog preserves the source hierarchy, engine context, step order, diagnostic branches, safety notices, tables and illustration positions. All diagrams remain source assets; the site does not import the manual's page styling or execute its scripts. Search uses SQLite FTS5 and glossary aliases. A shared engine selector filters search, system/subsection counts and related articles while retaining references whose application is unspecified. Article cards select a substantive illustration from the same document, including scalable connector faces. Internal repair references link directly to matching articles; unresolved reference boilerplate and exporter-only manual overview pages are omitted. See [API documentation](docs/API.md) for the versioned, read-only API used by the web interface and future mobile clients.

Teaching guides are authored separately, linked to a hash of their exact source content. A guide is accepted only when every editable source block is covered. Part numbers, pin assignments, numerical specifications and original media stay traceable to the reference. The single Atlas reader combines available teaching context with the complete technical article. Complete introductory coverage does not imply every procedure has been rewritten. Private source hashes, archival PDFs and authoring audits remain available to the local validation pipeline; no public PDF/source route or comparison interface is exposed.

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

Check wiring applicability against the original diagram: flattened text loses the difference between a page heading and a label inside one branch. Connector circuit names can also be generic across Ford applications. Use the Mustang's matching component-operation and diagnostic references to explain the actual mechanism, while preserving the connector's literal labels in its technical table.

Create `work/topic-context-jobs/stop-after-current` to drain active batches before restarting. Remove it to resume. If a controller exits after Codex writes its result but before checkpointing it, stop the worker and run `node scripts/recover-context-jobs.mjs` to preview recovery, then add `--apply` to restore eligible missing checkpoints. Run recovery before starting a new plan; changed evidence, source hashes, group IDs, or unsupported references are rejected. Structural acceptance is not a human technical review. The coverage audit must report every document before the introduction pass is considered complete.

See [deployment and operations](docs/DEPLOYMENT.md).

## Maintenance and workshop library

The Maintenance area combines an internal normal schedule with searchable maintenance, diagnostic, repair and overhaul guides. Browse by vehicle system, job type and difficulty, or search using everyday symptoms. Each guide explains the component, why the job matters, preparation, the sequence of work and the checks afterward. Diagnostic decision tables connect observations to the next check. Direct procedure links preserve engine, gearbox, equipment and operation-phase differences. Repair articles also link back to relevant teaching guides.

Engine selection scopes both the guide list and procedure links. The existing 46 guide URLs remain available. Verified base-car intervals are not applied to the 5.2L Shelby, and diagnostic tests or repairs use condition-based triggers without invented replacement intervals. Public normal-schedule references lead to `#/maintenance/schedule`; the original evidence stays available in private authoring records.

The completed workshop expansion adds 902 guides, for 948 in the combined library. The source inventory has no pending supported jobs or reserved chapters. Missing or conflicting operations are recorded privately and excluded from coverage claims; an accepted guide teaches its supported scope without inventing the unavailable continuation. Counts describe editorial coverage, not a claim of independent human technical review.

Scheduled care is in `content/maintenance-guides.json`; the workshop expansion is in `content/workshop-guides.json`. The locally generated `content/workshop-coverage.json` inventory binds source documents and exact diagnostic sections to accepted guides. Its unresolved-scope notes stay private: the file is excluded from Git history, deployment and public responses. Run `node scripts/audit-maintenance-guides.mjs` to validate guide, schedule, article, thumbnail and coverage references. See [maintenance authoring](docs/MAINTENANCE-GUIDES.md), [workshop authoring](docs/WORKSHOP-AUTHORING.md) and [API documentation](docs/API.md). The article Parts panel shows confirmed part numbers only and is omitted when no such parts are available.

## Original image quality

The reader uses verified, unresized Ford illustrations when available, with a shared image mapping for documents and glossary entries. Small tool previews remain compact; the image viewer offers Fit, true 100% size, and scrollable zoom. Vector diagrams remain scalable. See the image recovery workflow in [deployment and operations](docs/DEPLOYMENT.md).
