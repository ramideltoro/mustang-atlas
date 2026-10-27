# Reference article teaching pass

This workflow stages a complete, independently reviewed enthusiast rewrite of the public reference corpus. It never writes the public content catalog or live `data/guides`. It uses the locally signed-in Codex CLI; it does not call a model API or load API credentials.

## Scope and evidence

`node scripts/reference-editorial-run.mjs --prepare-only` inventories every public SQLite document. The initial inventory is 2,264 documents: 245 overviews, 184 diagnostic articles, 967 repairs, 40 specification references, 16 general articles, 382 wiring references, and 430 connector references. There are 409 documents without editable prose. Those need a specific reading guide for their tables or illustrations, not invented repair instructions.

Every structured block, table row, illustration, and the entire extracted text becomes an evidence unit. Chunking retains all units and exact editable block IDs. It does not cut off long source documents. The initial plan has 235,672 evidence units in 5,140 chunks. The source text is deliberately included in addition to structured blocks to account for labels the importer may not have placed in a block. This evidence duplication is not duplicated public prose.

Each associated image is attached to both author and reviewer at up to 2,400 pixels per dimension. An unreadable label is a reason to hold a claim, never to guess it. Related references are included in full only if small enough and without unreviewed illustrations; other targets remain explicit unavailable prerequisites. The article must retain those referrals and must not claim a standalone procedure when supporting instructions are unavailable.

## Run and resume

```sh
node --test scripts/reference-editorial-selftest.mjs
node scripts/reference-editorial-run.mjs --prepare-only
node scripts/reference-editorial-run.mjs --ids G1686641,G1688123,connector-C197B,wiring-132-001
node scripts/reference-editorial-run.mjs
node scripts/reference-editorial-run.mjs --retry-held --limit 10
```

The runner uses one CLI process at a time. Author and fresh independent reviewer run sequentially. `--max-attempts` defaults to two per chunk. A source/context/prompt fingerprint invalidates checkpoints when evidence changes. Completed chunks resume; a document is accepted only after every chunk passes. A `work/editorial-references/stop-after-current` file drains the current document. SIGINT/SIGTERM terminates the active CLI and leaves the document pending. Remove the drain file before resuming.

`work/editorial-references/progress.json` reports the complete corpus, not merely a selected pilot. `state.json` explicitly records pending, active, held, and accepted documents, reviewed chunk counts, and blocking reasons. `documents/<id>/<fingerprint>/` contains exact inputs, image attachments, raw drafts, reviewer verdicts, and accepted chunk checkpoints. All are private working artifacts. No pending or held document is advertised as rewritten.

A passed automated review is not a human technician's certification. Mechanical validation preserves numbers/units/identifiers in their original blocks; semantic review additionally checks actions, sequence, warnings, branches, scope, supported explanations, teaching quality, and tone. Any reviewer issue holds the chunk. First-person editorial language never fabricates a personal workshop experience. Humor may include mild profanity but stays out of warnings and precise instructions.

## Publishing contract

Accepted full-document overlays are staged in `work/editorial-references/accepted/<id>.json`. They retain the existing overlay fields: `documentId`, `sourceHash`, `title`, `introduction`, `requirements`, exact-ID `edits`, `editorialVersion`, `status: complete`, and passing `checks`.

Additional fields:

```json
{
  "referenceEditorialVersion": "enthusiast-v2",
  "referenceReview": {
    "kind": "independent-codex-technical-review",
    "humanReviewed": false,
    "sourceUnitCount": 15,
    "sourceChunkCount": 1,
    "reviewedChunkCount": 1,
    "fingerprint": "source-context-prompt-plan SHA-256",
    "reviewedAt": "ISO timestamp"
  }
}
```

Before publication, require current state `accepted`, matching state/overlay fingerprint and source hash, all chunks reviewed, then run the existing `validateGuide` with current curated context. Copy only those accepted overlays to `content/guides/` for tracked publication (or the separately managed deployment overlay location). `content/guides` takes precedence over `data/guides`; never leave a stale tracked overlay overriding a newer staged one. Rebuild and run site validation before deployment. Original structured tables and illustrations remain attached; teaching edits replace prose without modifying technical evidence. Reader integration exposes the reviewed version and ensures the reviewed introduction is visible even when system or circuit context also exists.

The initial scope requires at least 10,280 CLI author/reviewer invocations before retries. The inventory and tools are not evidence that this full pass has completed; consult current state and accepted artifacts for actual completion.

## Pilot findings and editorial revisions

The initial pilot deliberately included overview, repair, wiring, and connector material. The first overview passed technical checks but sounded too clinical. A separate editor revision added useful, original enthusiast analogies and removed repetitive scope disclaimers, then passed a fresh independent review with the current teaching context. Editorial revisions live under `work/editorial-references/revisions/`; preparation does not delete these artifacts. `scripts/reference-editorial-review-revision.mjs <revision-directory>` validates and independently reviews complete single-chunk revisions, with full explicitly supplied image attachments when applicable. Its accepted output adds a `referenceReview.editorialRevision` draft hash.

A wiring pilot exposed an evidence-preparation bug: transparent SVG pixels made black labels disappear against the image viewer’s dark background. Future pipeline PNG attachments are flattened onto white. The preserved local PDF export and the same source SVG on white resolved the qualifier and continuation-label associations. Missing labels in that initial raster were not missing source information. Source exports must be visually checked before calling a label ambiguity a source blocker. Multi-page PDF exports must be reviewed in full, not just their first page.

The A/C compressor-belt repair pilot remains held: the source names accessory-drive-belt ribs in parts of A/C-belt installation, and the complete illustrated prerequisite procedures need review. This requires source reconciliation and prerequisite coverage, not invented replacement wording. The full unattended corpus batch has not been launched following these pilots.

The follow-up bounded batch selects 20 references (10 distinct overview topics and 10 connector references), recorded in `work/editorial-references/batch-20.json`. It runs the full author and independent reviewer sequentially, not a template-only transformation. Connector and wiring single-chunk jobs additionally attach every page of the preserved local source PDF export; missing page output or a source export exceeding 12 pages is held for dedicated review rather than silently truncated. Vector images are rendered at a legible density and flattened onto white.

Validated editorial revisions are recognized during preparation and retained as accepted even when generation prompts change. The runner records their artifact path and original review metadata instead of replacing them with an older generated draft. Source hash, complete unit count, review coverage, and current production validation must still match. Voice rules now require natural topic-specific explanation, suppress repetitive missing-information disclaimers, and prohibit mentioning internal chunk boundaries in reader-facing prose.

Completeness is assessed against the article’s purpose. A connector-reading reference can teach its drawing and tables without providing probing, access, wire-selection or replacement instructions. Unspecified optional codes remain uninterpreted scope limits; they are not automatically a source contradiction. Actual required repair steps, conflicting evidence and unsupported claims still hold publication. Present-tense first-person guidance is an editorial voice, not an invented autobiographical experience.

The supervisory pass also checks the rendered content role. Heading edits must remain concise single-line titles; explanation belongs in `why` or the introduction. Structural validation rejects paragraphs stuffed into headings before technical review. `supervisory-review.json` distinguishes readable, publication-ready drafts from accepted technical drafts still needing voice or structural polish. Those corrections receive a fresh independent review before being offered for publication.

The first bounded 20-reference batch finished with 20 supervised, independently reviewed staged articles: 71 rewritten editable blocks and 322 complete source units. Three drafts received an additional editorial/structure correction and a fresh independent review. `work/editorial-references/batch-20-ready.json` selects the exact final artifacts, including those corrections; do not publish by blindly copying the `accepted/` directory. Together with the earlier three revisions, this workflow has reviewed 23 of 2,264 references; 2,241 remain. These counts describe content review, not deployment. The worker did not change public catalogs.

## Continuous grouped queue

`node scripts/reference-editorial-run.mjs --prefer-small --batch-size 8 --retry-held` continues the entire remaining corpus without a document-count limit. Up to eight document workers feed a single serialized Codex CLI dispatcher. Within equally sized chunk plans, illustrated or substantive entries are prioritized ahead of very short text-only referral entries; every remaining entry stays in the queue. Shared author and reviewer calls contain separate document inputs and outputs, bounded to 100,000 input characters and 12 images per group; an individually larger complete source chunk remains intact. Every attached image is assigned a document ID and sequential image index. Exact result identity and per-document validation prevent output reassignment. Full source, numeric and semantic checks still apply to each document separately.

Shared request audit files live in `work/editorial-references/shared-jobs/`; each individual attempt contains its own input/output and a pointer to the shared request. Accepted chunks and documents remain independently resumable. Calls stop only for an explicit drain/interruption, authentication/account limit, or exhaustion of the queue; a held document does not stop other work.

`node scripts/reference-editorial-ready.mjs` refreshes `full-queue-ready.json`, excluding the previously published 23-reference baseline and rechecking current source identity, context, coverage, independent review and heading structure. The release coordinator consumes its exact artifact paths; the writing worker never deploys. `holds.json` records unresolved claims and available canonical source destinations. Referral-only stubs must remain clearly bounded navigation entries, not invented full diagnostic or overhaul procedures.

The imported generic reference `G1693180` is “About this Manual” (100-00), not an engine-specific specification or repair target. It appears on 886 source documents. The runner identifies this excluded background page separately from unavailable procedural prerequisites, preventing a generic conventions link from being mistaken for missing model-specific measurements. This classification does not supply missing limits or authorize an incomplete repair.

Complete supporting procedures can now enter a bounded evidence package rather than being excluded merely because they contain illustrations. Each included destination retains all source units and all associated images; oversized destinations remain explicit referrals, never silently truncated. Direct `related` edges can form a nested chain, with engine applicability checks. The initial budget is 40,000 supporting characters and enough additional images to keep a document package within 12 images. A Battery Tray package, for example, includes both Battery and Battery Disconnect and Connect: 20 supporting units and four illustrations.

The overlay records `supportingSourceRefs` with document/source hashes, `referencedBy`, original direct reference, unit count and media count. Independent author/reviewer coverage includes those additional units. Runtime validation resolves each destination from the trusted database and checks identity, exact source hash, counts, applicability, and a reachable acyclic source-reference graph. Supporting evidence can substantiate explanations, introductions and prerequisites; the primary action text and title retain their original numeric guard. `referenceReview.supportingSourceCoverage` is `complete-units-and-illustrations`, with exact document/unit totals. A missing required nested procedure remains a hold.

Source-gap-only drafts are held immediately instead of spending a second generation attempt on unchanged evidence. Correctable drafting errors still receive the configured retry. This is a throughput improvement, not a relaxation of source requirements.

The first live-data package pilot, Battery Tray (`G1692365`), passed independent author/reviewer assessment and runtime validation v3 with seven primary units plus 20 supporting units, and five total illustrations. It teaches the nested battery-removal/reconnection steps and preserves the separate terminal, hold-down and tray tightening values. This is recorded as automated review, not human certification. The runtime source-unit counter was also compared with the editorial counter across all 2,264 public documents: zero mismatches. The unlimited queue resumed after that pilot.

A subsequent supervisory read held that first Battery Tray pilot before publication: its nested mechanical steps were reviewed, but task-specific engine/startup and battery handling precautions were missing. An automated pass is not final acceptance when new evidence reveals an omission. `supervisory-holds.json` excludes such entries from the ready manifest until the correction receives fresh review. The correction uses a hash-bound navigation-only About Manual bridge to complete General Safety and Battery Safety evidence; navigation prose contributes no technical or numeric evidence. Repeated copies of the same warning-icon bytes may share one attachment while every media ID retains an explicit mapping.

Shared author/reviewer calls now deduplicate byte-identical illustrations and complete supporting-source payloads within the call. Each article carries an explicit allowlist of shared source keys and its unchanged expected unit IDs. Sources used only by a different article never enter this article’s numeric evidence. The global image map preserves document/local-image associations even when one attachment serves identical bytes. Original full per-article inputs are written before dispatch, so audit packets remain self-contained even on a failed call. Tests cover cross-document numeric contamination and shared-image association. The first two-article safety refresh reduced 75,706 original input characters to a 57,718-character shared call without dropping any source units.

For a focused preparation correction, `--preserve-reviewed --refresh-ids <IDs>` forces a fresh review while locking the reviewed title, introduction, every technical text/explanation pair, and all existing requirement groups. Only task-relevant sourced preparation groups may be appended. A material existing defect is held for explicit correction. The 14-entry `safety-refresh-queue.json` records the initial catch-up pass. Its accepted overlays retain the original review and baseline hash. On restart, compute unfinished targets from their artifacts; do not blindly force already-completed safety refreshes again.

### Startup preparation clarification

Repair drafts with the exact reviewed General Safety source now receive a narrow requirement-only clarification before independent review: explicit ignition OFF before key removal, and conditional remote-start wording where not already conditional. The helper does not edit action blocks, diagnostic states, or numeric instructions. Each changed field is recorded next to its author/reviewer attempt. Already reviewed candidates use separate exact-diff revisions and coordinator approval. Body-closure packages include the complete body-repair precautions for applicability review; this does not make welding, chemical, or collision instructions apply to simple trim removal.

The complete supporting-evidence budget is now 80,000 characters and 16 total source images per article (overridable with `--support-chars` and `--source-images`). A read-only audit showed the former 40,000/12 ceiling excluded available safety references on otherwise small repairs. These are bounds for complete documents, never truncation targets. Per-article numeric/source validation and independent coverage review are unchanged. Shared calls still pack within their normal budget; an individually larger complete article is dispatched alone.

### Narrow external safety supplements

The brake-dust pilot preserves the complete official EPA HTML and main-page text privately, with retrieval time and hashes. Its separate three-item home-mechanic preparation group has independent active-agent source review. It leaves manual fastening, access and numerical evidence unchanged and provides a public EPA citation. The complete resulting repair still receives an independent technical review with one additional explicitly identified supplemental source unit. This distinguishes review of a supplement from review of the whole repair. Supervisory holds remain until the final artifact is inspected. The staging helper is `scripts/reference-editorial-stage-brake-dust.mjs`; artifacts are under `work/editorial-references/supplemental/epa-brake-dust/` and the two `revisions/*-epa-dust/` folders. No runtime source-trust rules are relaxed.

### Ordinary completion checks and bounded corrections

A repair can end with ordinary operation of its fitted controls after complete reassembly and work-area clearance. This is distinct from circuit fault isolation, a new diagnostic threshold, adjustment, or inferred disassembly. Where a separately reviewed practical guide covers the same primary source, record its exact identity/hash and completion wording as a consistency reference. Preserve the manual's service restrictions: for example, do not operate the brake pedal while a stoplamp switch is being removed or fitted; a lamp check comes only after the switch is fully installed and connected.

Already passed articles can receive narrowly scoped increment reviews with exact before/after artifacts and unchanged technical actions/specifications. A held draft that never passed full review still requires a full independent source-and-illustration review; approval of the completion increment alone cannot make the article accepted. The revision reviewer sets its completed chunk count only after the full review passes. Unrelated general warnings about equipment not serviced by the job should not be accumulated as boilerplate.

The switch and blower completion corrections are staged separately from the stoplamp held-draft review. The latter retains its original author hold and the earlier missing-safety-referral review. A serialized sequencer drains the existing reference workers, uses the same CLI slot for the complete review, and resumes the unlimited queue regardless of that review's outcome. Failed artifacts remain held for correction. Restart ordinary work without `--retry-held` unless new evidence or a specific correction justifies revisiting a held article.
