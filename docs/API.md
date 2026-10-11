# Mustang Atlas API

Read-only JSON at `/api/v1`. Lists return `{items,total,limit,offset}`. Document IDs are opaque stable references: Ford workshop IDs such as `G1660463`, `wiring-132-001` and `connector-C2123`.

- `GET /stats`: source document counts, media placements, distinct assets, system counts and accepted teaching coverage.
- `GET /systems`: `{items:[{id,title,description,introduction?,howItWorks?,documentCount,sections:[{id,title,count}],engines:[]}],total}`.
- `GET /documents?q=&system=&kind=&engine=&section=&limit=30&offset=0`: searchable document summaries. Kinds are `repair`, `diagnosis`, `overview`, `specifications`, `general`, `wiring`, `connector`. Additional optional `source.calculatorType` identifies a saved torque-wrench calculator reference. Empty engine list means the index has no explicit engine restriction, not that a procedure applies to every engine.
- `GET /documents/:id`: complete document with structured blocks, original media and resolved related documents. Add `?source=1` to include unedited `sourceBlocks` for comparison and editorial tools.
- `GET /glossary?q=&limit=100&offset=0`: shared term index; `GET /glossary/:id` returns explanations, exact source references and media.
- `GET /source/:id.pdf`: original PDF, with range requests supported. Some supplementary HTML references may not have a PDF; their `source.pdfUrl` is null.
- `GET /media/:filename`: original raster illustration or sanitized vector drawing.
- `GET /healthz`: service and catalog readiness.

Document summary: `{id,title,systemId,section:{code,title},kind,engines:[],summary,teachingStatus,source:{reference,pdfUrl,revision}}`. Detail additionally returns `sourceHash`, `blocks`, `media`, `related`, optional `introduction`, optional `requirements`, and optional `sourceBlocks`. Teaching status is `source` until a complete accepted overlay matches the current source hash; `complete` means a Codex editorial overlay passed its declared checks, not human review. Source text remains available in the original PDF and through `sourceBlocks`.

Every block has a stable `id` and `type`. Recursive block types:

- `heading`: `level`, `text`.
- `paragraph`: `text`, optional editorial `why`.
- `safety`: `severity` (`warning`, `caution`, `notice`, `note`), `text`.
- `step`: original `number`, `text`, `children` in source order, optional `why`.
- `list`: `ordered`, `start`, `items`; each item is `{id,type:"list-item",text,children}`.
- `table`: `rows:[{cells:[{text,colSpan,rowSpan,header,blocks:[]}]}]`; nested cell blocks retain figures, lists and sub-tables. Source cell text and technical values remain unchanged by editorial overlays.
- `media`: `mediaId` referencing the document's media array.
- `missing-media`: `text` describing a missing source image reference.

Media entries: `{id,url,mime,width,height,caption?,legend?:[{color,label}]}`. All source illustrations retain their original order and associations. Empty style-only layout tables are unwrapped. Diagrams render as images rather than executable inline SVG. Source URLs, local paths, raw HTML, CSS, scripts and JavaScript links are never returned.

Verified larger originals can be selected through `data/media-quality.json`: `{version:1,assets:{"/media/<original-sha256>.jpg":{url:"/media/<native-sha256>.jpg",mime:"image/jpeg",width:1902,height:1250,sourceWidth:580,sourceHeight:381}}}`. The map is reloaded when its file identity changes. Safe local asset URLs, matching original dimensions, a larger image and an existing target file are required; invalid or unavailable overrides fall back to the original. Document and glossary media share the same resolver. Upgraded entries retain their original `id`, caption and associations, and add `originalUrl`, `sourceWidth`, `sourceHeight` and `quality:"native-source"`. Public dimensions describe the selected image. Optional private download provenance is not returned. This presentation layer does not change catalog source hashes, blocks, PDFs or editorial acceptance. The Codex worker resolves the same map when preparing each job's image inputs.

`node scripts/upgrade-pdf-media.mjs` produces lossless 4096px-long-edge renders of the vector Metrics reference and writes proposed overrides to `work/media-quality-metrics.json`. It never writes the live quality map, so it can run safely during bulk recovery. Its PDF and catalog access are read-only; generated PNGs use content-addressed media filenames. Raster-containing pages are rejected to avoid presenting an enlarged low-resolution image as recovered detail. Merge the proposal only after the bulk map writer has stopped.

Editorial files: `content/guides/<id>.json` and `data/guides/<id>.json`, containing `{documentId,sourceHash,title?,introduction?,edits:[{blockId,text,why?}],requirements:[{category,items:[{name,detail}]}],status:"complete",checks:{passed:true},checkedAt?,model?}`. Edits replace plain text leaves only, retaining every original media/table block. Full accepted coverage, valid unique block IDs and exact source hash are required. The API does not generate content or contact any AI provider.

`content/glossary.json`: `{version:1,terms:[{id,name,aliases,definition,details,category,sourceRefs:[{documentId}],mediaRefs:[{documentId,mediaId,caption?}],relatedTermIds:[]}]}`. `content/systems.json`: `{version:1,systems:[{id,title?,description,introduction,howItWorks:[{title,body}],sourceRefs:[{documentId}]}]}`.

Ingestion: `node scripts/ingest.mjs --source /path/to/source --data data`. The catalog and an ingestion manifest are written under data. Catalog reads do not mutate SQLite; this supports a read-only production mount. Search tokenizes and quotes user input and binds all SQL parameters. Pagination is bounded, API responses are JSON, and no write endpoint is exposed.

The thirteen system titles remain short navigation labels. Authored explanatory headings are returned separately as `contextTitle`; `introduction` and `howItWorks` provide the system teaching context. Ingestion uses TOC references rather than repeated HTML metadata IDs, keeping engine variants distinct. Duplicate shortcut documents receive a deterministic path suffix.

Audit the complete catalog and its exact media placements with `node scripts/audit-catalog.mjs`. Check source-text preservation with `node scripts/audit-source-text.mjs --source /path/to/manual`; this independently compares all imported HTML body text, in order, with the parsed blocks after removing navigation, source headers, scripts, styling and inactive form controls. Whitespace is normalized. Reports are saved under data.

`sourceHash` includes the source-file hash, parsed blocks and media metadata; a parser change therefore invalidates prior editorial overlays. Diagnostic prose inside tables is represented as editable cell blocks; short technical values and labels stay immutable. Non-li content in malformed source lists, table captions, safety severity and every original media placement are preserved.

`GET /abbreviations?q=` returns the complete source acronym index with resolved references. Unambiguous expansions also appear in `/glossary` when their name does not collide with an authored term or alias. They use `editorial.kind: "source-expansion"` and an exact source expansion as their definition; fuller authored explanations take precedence. Accepted document guides supply their plain-language title and introduction in catalog cards as well as the detail response.

Publication validation is shared by the API and Codex worker in `server/guide-validation.mjs`. The API independently checks identity, source hash, complete block coverage, numeric values, recognized quantity/unit pairs, and explanatory metadata; a saved `checks.passed` flag alone is insufficient. Unit notation equivalents such as `lb.ft` and `lb-ft` are accepted, while changed units, new per-action numbers and lost temperature signs are rejected. Markdown link targets do not count as technical values; visible link labels still do. Introductions, requirements and explanations are checked against the document’s visible source/table evidence and its selected curated context. These deterministic checks are not a human technical review.

Validation results are cached by source hash, guide file identity and curated content identity, and invalidated on file changes. Worker restart revalidates published files and saved partial edits with the current rules. Invalid partial edits are returned to the work queue rather than being treated as completed. Small documents include their original illustrations in full; longer documents select media in source order around each text chunk, including following action illustrations and bounded preceding context. Batches are split around a 24-image budget where possible; required images are not silently discarded.
