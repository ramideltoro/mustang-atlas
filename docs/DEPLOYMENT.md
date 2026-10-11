# Deployment and operations

Production runs at `https://mustangatlas.ramideltoro.com` on the backend VPS in `/srv/mustang-atlas`. Docker Compose exposes the application only at `127.0.0.1:3185`; the existing Caddy service handles HTTPS. Change only the marked Mustang Atlas block in the shared Caddy configuration.

## Release

1. Run tests, build the client, and finish the catalog audit locally.
2. Copy the project source (excluding `.git`, `node_modules`, local logs, `work`, `.env` and `data/rewrite`) into the deployment directory.
3. Copy `data/atlas.sqlite`, `data/catalog-manifest.json`, `data/media`, `data/source` and accepted `data/guides`. Do not copy a database during ingestion. The catalog uses a completed SQLite file, not a live ingestion connection.
4. Run `docker compose up -d --build` from `/srv/mustang-atlas`.
5. Verify `/healthz` and `/api/v1/stats` through loopback before changing Caddy to `reverse_proxy 127.0.0.1:3185`.
6. Validate Caddy configuration, reload it, and verify the public site, search, a guide, glossary media, a source PDF and an original wiring diagram.

The container runs as an unprivileged user, with a read-only root filesystem and data mount, all Linux capabilities dropped, and bounded CPU/memory/logs. No manual conversion, external model calls or credentials are needed on the server.

## Updating content

Ingestion is a local, offline operation. A parser or source change modifies the content hash and invalidates older teaching overlays automatically. Complete guides are replaced atomically. The API checks guide file modification times, so newly accepted teaching content does not require rebuilding the application.

For a new full corpus, stage and audit it before replacing the database and restarting the container. Preserve a previous release only when an operational rollback is required. Generated data is excluded from Git because it includes the supplied manual and derived media.

## Monitoring

`GET /healthz` reports service availability and catalog size. `GET /api/v1/stats` reports exact catalog, media and accepted teaching-guide counts; teaching coverage is reported separately from extraction coverage. Docker performs an HTTP health check. CI runs unit/integration checks and builds the frontend on pushes.

Credential values remain in the operator's central credential store and must never appear in this repository, deployment logs, browser bundle or generated content.
