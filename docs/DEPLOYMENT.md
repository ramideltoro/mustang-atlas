# Deployment and operations

Production runs at `https://mustangatlas.ramideltoro.com` on the backend VPS in `/srv/mustang-atlas`. Docker Compose exposes the application only at `127.0.0.1:3185`; the existing Caddy service handles HTTPS. Change only the marked Mustang Atlas block in the shared Caddy configuration.

## Release

1. Run tests, build the client, and finish the catalog audit locally.
2. Copy the project source (excluding `.git`, `node_modules`, local logs, `work`, `.env` and `data/rewrite`) into the deployment directory.
3. Copy `data/atlas.sqlite`, `data/catalog-manifest.json`, `data/media`, `data/source` and accepted `data/guides`. Do not copy a database during ingestion. The catalog uses a completed SQLite file, not a live ingestion connection.
4. Run `docker compose up -d --build` from `/srv/mustang-atlas`.
5. Verify `/healthz` and `/api/v1/stats` through loopback before changing Caddy to `reverse_proxy 127.0.0.1:3185`.
6. Validate Caddy configuration, reload it, and verify the public site, search, a guide, glossary media, engine-filtered subsections and an original wiring diagram. Confirm `/source/<id>.pdf` returns 404.

The container runs as an unprivileged user, with a read-only root filesystem and data mount, all Linux capabilities dropped, and bounded CPU/memory/logs. No manual conversion, external model calls or credentials are needed on the server.

Public catalog counts exclude exporter-only “About this Manual” entries. Keep the archive outside static directories: the application serves only scoped `/media` assets, public JSON and the client build. Private source files and hashes must not appear in article responses.

## Updating content

Ingestion is a local, offline operation. A parser or source change modifies the content hash and invalidates older teaching overlays automatically. Complete guides are replaced atomically. The API checks guide file modification times, so newly accepted teaching content does not require rebuilding the application.

For a new full corpus, stage and audit it before replacing the database and restarting the container. Preserve a previous release only when an operational rollback is required. Generated data is excluded from Git because it includes the supplied manual and derived media.

## Monitoring

`GET /healthz` reports service availability and catalog size. `GET /api/v1/stats` reports exact catalog, media and accepted teaching-guide counts; teaching coverage is reported separately from extraction coverage. Docker performs an HTTP health check. CI runs unit/integration checks and builds the frontend on pushes.

Credential values remain in the operator's central credential store and must never appear in this repository, deployment logs, browser bundle or generated content.

## Image quality recovery

The offline Ford export contains reduced-size workshop illustrations. Recover the unresized originals with an existing authorized Ford publication session:

```sh
node scripts/upgrade-media.mjs --session-config /private/path/params.json --session-cookies /private/path/cookieString.txt
node scripts/sync-media.mjs
```

The local recovery worker matches the resized source bytes against the catalog's SHA-256 image identity before requesting the same illustration without width/height parameters. It accepts a larger image only when its proportions agree. It never sharpens, redraws, or invents technical detail. SVG illustrations remain vectors. Session cookies are read from the supplied private path and sent only to Ford's publication endpoint; they are not written to generated content, logs or the repository.

Progress and resumable state are kept in `data/media-quality-progress.json` and `data/media-upgrade/`. Use `--first G2214748` to prioritize a reference, `--limit 1` for a small verification run, or `--concurrency 4` to bound source requests. A normal interrupt checkpoints completed images. On resume, missing recovered files or map entries are fetched again. Unmatched images retain the existing source asset for review.

`data/media-quality.json` maps original catalog URLs to verified larger image assets. This presentation layer preserves document hashes, figure IDs, captions, callouts and teaching-guide coverage. The API and Codex writing worker resolve the map dynamically; restart an older writing worker after its current batches to load this capability. Original PDFs remain unchanged as private archival and validation inputs; the application does not expose PDF/source routes.

`sync-media.mjs` snapshots the map, transfers every referenced media file first, and then atomically publishes the map. It supports the same `ATLAS_DEPLOY_HOST` and `ATLAS_DEPLOY_DATA` overrides as guide publication. It never copies the Ford session or local recovery state. The API reads map changes without a container restart. Publish image improvements independently of guide updates.

The two Metrics reference pages can be rendered directly from their vector PDF with `node scripts/upgrade-pdf-media.mjs`. It creates a separate proposal at `work/media-quality-metrics.json` and refuses to overwrite the live map. Merge its `assets` into the quality map only after the recovery worker stops, then publish with `sync-media.mjs`. The source PDF is kept intact. The torque-adapter calculator JPEGs already use their upstream original files.

Component-location SVGs with omitted MIME types in embedded raster images can be recovered with `node scripts/repair-svg-media.mjs --source /absolute/path/export`. The script creates `work/media-quality-svg-repairs.json` without modifying the catalog or live map. It verifies the original document hash, unchanged SVG geometry, and exact embedded image bytes; it also checks that sanitizing the result a second time makes no changes. Review the rendered diagrams, merge the proposal's `assets` into the map, and publish with `sync-media.mjs`. Deploy the SVG repair resolver before publication: only verified SVG-to-SVG repairs with identical dimensions may use `sourceKind: "svg-embedded-raster-repair"`. Their public quality label is `restored-source`; ordinary raster upgrades must still increase resolution.

Run `node scripts/audit-media-quality.mjs --source /absolute/path/export` after recovery. It verifies file hashes, decoded dimensions and source proportions across the quality map, reports catalog coverage, and ranks pixel differences for visual inspection in `work/media-quality-audit.json`. SVG restorations are counted separately and checked for unchanged geometry, safe embedded image decoding, and exact agreement with the supplied source. Pixel differences from JPEG resizing are not treated as proof of changed content. Source identity for larger originals is established by matching the resized Ford asset bytes before retrieving its unresized counterpart.

## Publishing topic explanations

The container mounts `content/` read-only in addition to `data/`. Authored topic contexts are static JSON; the API reloads them by file identity and rejects stale source hashes, invalid links, and unsupported references. `node scripts/sync-contexts.mjs` validates a stable local snapshot, transfers it to a temporary file on the VPS, then renames it atomically. `--watch` follows the finite local topic-authoring worker and exits after its last publication. Glossary and application changes still belong in the normal GitHub/deployment release. No authoring credentials or jobs are deployed.
