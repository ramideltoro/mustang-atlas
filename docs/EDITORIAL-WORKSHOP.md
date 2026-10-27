# Workshop editorial rebuild

This pipeline rewrites the 902 published workshop guides as practical enthusiast articles. It **does not publish**. It uses the existing ChatGPT-authenticated Codex CLI, strips API credentials from subprocess environments, and refuses API-key authentication. There is one subprocess at a time; author and independent reviewer are separate ephemeral sessions. Codex usage limits still apply.

## Editorial contract

The previous authoring contract targeted 400–650 words and allowed directing readers to procedures instead of explaining execution. This rebuild removes that target. Articles must explain access, actual actions, observations → meaning → decisions, configuration-specific specifications and replacement parts, and completion checks. They must explain unfamiliar terms in original, friendly first-person language. Natural garage humor and occasional profanity are welcome; warnings and exact technical instructions stay literal. No fabricated repair memories or guessed instructions.

The established source exceptions, engine scopes, primary procedure spans and reviewed evidence are reused from `workshop-author-plan.mjs`. The old authoring prompt, acceptance shortcut and publication routine are **not** reused. The output shape and numeric normalization utilities are shared for compatibility.

## Run and resume

From the repository root:

```sh
node --test scripts/editorial-workshop.test.mjs
node scripts/editorial-workshop.mjs
node scripts/editorial-workshop.mjs --run --ids job-9bf5ab87a1dfae3f,job-b7859723f9f08ec0 --limit 2
node scripts/editorial-workshop.mjs --run
node scripts/editorial-workshop-validate.mjs
```

`--run` is required to call Codex. `--limit` counts attempted guides in that run. `--ids` selects a comma-separated subset. `--retry` retries rejected/failed guides; otherwise they remain in the review ledger without consuming repeat calls. Successful exact-fingerprint guides are skipped. A PID file prevents two workers sharing a directory. A `stop-after-current` file in `work/editorial-workshop/` drains the current guide. SIGINT/SIGTERM also requests draining. Remove the stop file to resume. Authentication/usage failures stop the queue; there is no provider fallback. A call has a 25-minute timeout.

All artifacts are private local work products under `work/editorial-workshop/`:

- `inventory.json`: all 902 guide IDs, exact input fingerprint, source/figure packet counts.
- `ledger.json`: per-guide authoring/reviewing/reviewed/needs-review/failed state and actionable errors.
- `progress.json`: current process, review count, remaining work.
- `jobs/<guide>/<fingerprint>/manifest.json`: source hashes, exact character offsets, scope and unresolved dependencies.
- Author/reviewer JSON, prompts, logs and source-image review copies: resumable per-call checkpoints.
- `reviewed/<guide>.json`: unpublished candidate plus base catalog hash and review folder.

Do not commit private extracted source text, source images or CLI logs. The repository's ignored `work/` area is intentional.

## Evidence and completeness

All primary spans are supplied, split into contiguous exact-offset nodes without dropped characters. Dependency expansion follows source `Refer to:` links for compatible execution procedures, with an explicit bounded-depth unresolved-reference ledger. Giant diagnostic sources are not blindly included as repair dependencies. Curated engine-health guides use explicit named heading boundaries rather than treating every engine diagnostic chapter as their scope. Original illustrations are supplied privately to reviewers; publishing preserves the existing independent art.

Partial source illustration selection follows structured blocks and their text offsets. A packet contains at most 24 figures; current figure groups contain six. Primary/source text packets are bounded to avoid context truncation. Large jobs are revised sequentially across packets, then **every packet is independently checked against the final article**. A later packet must not erase earlier actions. All packet reviews must pass. A genuine source/schema limitation is held as needs-review, never silently called complete.

The initial inventory remains large: many repair guides require extensive upstream disassembly and hundreds of figures. A finished prompt or a populated field is not evidence that an article is complete. The ledger's reviewed count means automated source review passed, **not human review** and not a claim that every possible vehicle procedure has complete source evidence.

## Acceptance and merge

Mechanical checks enforce source section IDs, known document links, primary references, physical quantities supported by evidence/applicability, safe text and the existing 60-row/12,000-character caps. The independent reviewer separately checks scope, actions, access, branch logic, warnings, measurements, applicability, visible figures, completion and tone. Every node requires a reason and candidate location, or a specific explanation of why it is outside scope. Rejected work gets one source-bound revision and a second full review; continued problems remain unpublished.

The runner validates each accepted replacement with `createMaintenanceGuideCatalog` in a temporary merged catalog before staging. The standalone validator checks the complete staged set against current content and source hashes. Before merging a staged guide, recompute SHA-256 of the exact existing guide JSON and compare with `baseHash`; verify all `sourceRefs` hashes against the current source database. If anything changed, rerun the source review. Preserve existing IDs/routes, independently designed art and applicable editorial metadata. Run normal site content validation/build and inspect representative final pages before deployment. No automatic catalog merge or deployment is built into this tool.

Changing the editorial contract or evidence selection requires incrementing `VERSION` so old reviewed artifacts cannot silently qualify under a new standard. Each actual CLI call also fingerprints its full prompt/schema/figure hashes.

## Application-scope findings and regressions

The front-hub pilot exposed an existing application error: G1692537 uses a central nut at 340 Nm, whereas G1692554 describes the separate SVT bolt-on hub at 133 Nm. Its matching SVT brake-disc dependency G1716189 uses 185 Nm caliper bolts, unlike the generic 115 Nm branch. The reference catalog now has hash-bound application mappings. The pipeline inherits current source-plan engines rather than trusting the old guide's broader application metadata. A scope-only correction is explicitly distinguished from a completed editorial rewrite.

`editorial-workshop-scope-audit.mjs` lists generic/SVT pairs for source review; it does not change their scopes automatically. The reviewed body pairs differ in actual attachment/access sequences, not merely names. `editorial-workshop-body-scope.test.mjs` uses fixtures to cover all 14 reviewed body mappings, changed-source invalidation, and unreviewed-title behavior. The optional `editorial-workshop-scope.test.mjs` inspects the local source database and is intentionally outside the default test suite.

```sh
node --test scripts/editorial-workshop.test.mjs scripts/editorial-workshop-body-scope.test.mjs
node --test scripts/editorial-workshop-scope.test.mjs
node scripts/editorial-workshop-scope-audit.mjs
```

The first published pilot also received an explicit editorial revision in `editorial-workshop-polish.mjs`: a more natural humorous opening, meaningful step groups, and an irrelevant tire-machine preparation paragraph moved to an optional note. That revision required a fresh independent review. A subsequent source-supported pilot-bore cleaning clarification is recorded as a supervising-editor correction in its staged record.

## Continuous queue notes

The full queue runs with `node scripts/editorial-workshop.mjs --run` and no limit. Diagnostic indexes and diagnostic repair endpoints remain hash-bound **reference-only destinations** rather than importing every linked replacement procedure. Otherwise a short DTC index expands into unrelated timing-chain and airbag work. Complete primary spans are retained, along with selected context and relevant lifting, wheel-removal, battery-disconnection, SRS-isolation and fuel-pressure prerequisites. Actual repair jobs retain execution-dependency expansion. A source-dependent diagnostic test can still be held if its necessary access instructions are missing; an endpoint link is not treated as proof of those instructions.

New direct embeds of original `/media/` artwork are rejected. When a procedure relies on numbered connector geometry that prose cannot identify reliably, it remains held for independently designed diagrams. The G1939867 terminal-removal video was recovered from a PDF URI annotation at the official Ford service-content host; its private file, checksum and limited observations are recorded in `work/editorial-workshop/terminal-removal-video-evidence.json`. This supplements evidence, but does not establish all vehicle-specific isolation or reassembly steps.

Expanded source spelling `Hertz (Hz)` is normalized for physical-quantity validation. This fixes a false rejection without relaxing cross-unit checks or inventing numbers. Values that exist only in a table's implied units still require explicit source-context confirmation.

Private evidence rendering uses an opaque white background for transparent SVG line drawings. A transparent black-on-transparent diagram previously appeared blank on a dark image viewer and correctly caused a passenger-switch article to be held. Versioned raster filenames and rendered-image hashes now invalidate stale author/reviewer image checkpoints. The regression test checks both white paper and visible black ink. Original source artwork remains private evidence; this change does not publish those images.

### Recovered private PDF access procedure

The overhead-console retry can consume a checksum-bound private supplement at
`work/editorial-workshop/evidence/access-audit/headliner-supplement.json`.
It restores the exact **Headliner – Lowering** procedure from the supplied 2015
workshop PDF, physical pages 2422–2424, including all three page images. This is
not the longer headliner replacement procedure. The supplement records the PDF
checksum, exact extracted text checksum, figure checksums, page numbers and
matching indexed A-pillar/quarter-trim dependencies. Source and rendered figures
remain private. An absent supplement leaves the normal missing-evidence hold;
a changed checksum fails closed.

External evidence nodes participate in the normal complete author/reviewer
coverage checks, but their identifiers never become fictitious public database
references. The guide cites the publication and physical pages in prose. Private
figure paths are restricted to the work directory. This narrow recovery does not
change database contents or broaden model-year applicability.

### Two-guide authoring: pilot and bounded queue mode

`editorial-workshop-pair.mjs` runs exactly two independently scoped, complete one-packet repairs through a shared author and a separate shared reviewer. Exact duplicate evidence is supplied once, but each guide retains its own allowed nodes, source hashes, base hash, numeric/reference validation, coverage verdict and full catalog validation. Conflicting identities, missing result IDs, incomplete review coverage and cross-guide quantities/references fail closed. Failed shared results fall back to isolated calls in the same CLI slot; no guide inherits another guide's approval.

Prepare without running a model:

```sh
node scripts/editorial-workshop.mjs --prepare-pair --ids FIRST,SECOND --directory work/editorial-workshop-pair-pilot
```

After the main worker finishes its current guide and exits, run `node scripts/editorial-workshop-pair.mjs work/editorial-workshop-pair-pilot` in its freed slot. Never overlap it with that main worker. Resume the main queue afterward with `--exclude-ids FIRST,SECOND` until the pilot outputs receive supervisory review. Pilot records remain in a separate private directory, carry `publicationHeld: true`, and are not collected by the publisher. `pilot-report.json` records actual calls, timing, deduplicated source size and individual outcomes. No broader rollout is implied by a successful pilot.

The two-guide pilot completed on2026-10-27: both guides passed independent source/figure review and full catalog checks in two CLI calls (4m45s total). Exact source text fell from18,278 to11,370characters through deduplication; all15figures remained. Supervisory review then added a rear-seat-fitted qualifier and an explicit stationary window completion check, preserving the original reviews.

Approved bounded queue mode is opt-in with `--pairs`. It retains a maximum of two guides per call and the same complete evidence/coverage gates, rejects shared-primary or likely same-component variants, and falls back to the isolated pipeline when no eligible pair exists or shared execution fails. Per-guide revisions remain isolated. The parent worker starts the pair subprocess in its existing slot, never alongside another call of its own; parent PID verification enforces that handoff. Successful records still pass the ordinary source/base/full-catalog gates before primary staging. Each pair has its own complete private report under `work/editorial-workshop/pairs/`.

Main-worker reservation manifests are explicit assignments to the secondary worker. They are recorded as `reserved` in the main ledger, not treated as completed. Already-reviewed staged records with an exact current base and valid source hashes are reused, including records imported by the secondary coordinator, avoiding duplicate authoring while publication is pending.

### Exact supervisory release gate and owner controls

A successful author/reviewer result is staged, not automatically publication-ready.
The release coordinator additionally requires an exact guide hash in
`work/editorial-workshop/supervisory-approvals.json` (or its secondary-worker
counterpart), recording a complete supervisory article read. A prose correction
invalidates that approval until the new exact hash is reviewed. Missing technical
evidence remains a hold even when schema and numerical checks pass.

The private owner-controls supplement contains complete 2015 owner-manual printed
pages 121–122, physical pages 124–125, with the PDF, text and both rendered pages
pinned to checksums in `editorial-workshop-owner.mjs`. Its explicit primary-ID
allowlist covers tasks requiring real ignition, gear-selection, engine-start or
powered completion controls; it never selects by a broad title keyword or applies
the 2015 evidence to another year. Existing reviewed records remain reusable.
Old holds do not acquire this supplement or automatically retry unless explicitly
requested; new enrolled holds retain the same evidence on restart.

Both author and reviewer receive the complete relevant owner evidence, with OFF,
engine-off ON and engine-start conditions distinguished. Backup-key recovery is
outside this supplement's teaching scope because that procedure continues onto
the following page. Cite the owner publication/page in prose; its private ID must
not become a nonexistent public source route. Original page artwork stays private.
The only external-source exception in two-guide mode is this exact complete owner
supplement. Unknown sources, changed text/figures or incomplete coverage still
reject pairing; headliner and other external procedures remain isolated. Shared
owner evidence is deduplicated without widening either guide's allowed evidence.

The exact SYNC 2/3 FDIM primary G1704008 now receives checksum-bound matching FCIM access G1704007 and its existing dependencies. This resolves the primary’s mislink to the separate SYNC display without changing public source data. Author/reviewer scope retains actual FDIM/APIM separation and touchscreen calibration, while preventing unrelated display removal or new-module PMI for a temporarily removed existing FCIM. A fresh full evidence review is still required; existing holds are not automatically cleared.

The private owner-controls allowlist now also includes the exact reviewed CAC intake, boost sensor, oil-pressure sender variants, SYNC 2/3 display, DSP, seat-climate module and A/C dye tasks. These additions follow observed control-sequence gaps in actual drafts. Complete owner text/page-image checksums, 2015-only scope and explicit enrollment rules remain unchanged; this does not re-run existing accepted or held articles automatically.

Five exact refrigerant-service primary procedures (recovery/charging, condenser and evaporator core tests, identification and oil adding) now receive the complete checksum-bound Climate Control Safety source G1693184. The narrow hook verifies both primary and dependency hashes and preserves all source text/figures for review. Teaching selects actual refrigerant handling precautions without importing unrelated heater work. Missing physical access, recovery/refit procedures or charge specifications remain holds; the hook does not clear or automatically retry existing held articles.

Climate safety enrichment is prospective or explicitly retried: existing held/reviewed/in-flight packages retain their fingerprints unless already enrolled. The ledger persists climateSafetyEvidence separately from owner-controls enrollment; regression coverage rejects implicit retries of old holds.

### Exact alignment specification recovery

The private authoring runner supplies complete hash-bound G1686608 alignment specifications to the three exact front-toe, rear-camber and rear-toe primaries. Rear camber also receives the actual rear-toe dependency. Original table columns, curb-load conditions and standard/GT350/GT350R qualifiers remain intact; no numerical acceptance is inferred from a generic alignment-machine instruction. Existing held or reviewed jobs are not automatically retried: enrollment requires new work, prior enrollment or explicit retry. Conditional LDW/IPMA completion remains a source-review gate. Fresh author/reviewer passes and exact supervisory approval are still required. The 22 focused workshop/pair/alignment tests pass, including changed-source rejection and hold-enrollment regression checks.

Wheel-stud source recovery is separately bound to the exact G1692541, SVT hub G1692554 and SVT disc G1716189 hashes. The hub dependency previously followed the standard disc link. New or explicitly retried/enrolled stud jobs now receive the complete matching SVT disc procedure; existing holds do not silently change. Fresh review must retain the SVT caliper replacement fasteners and specifications, followed by any separately reviewed practical dust-control supplement before supervisory release.

### Tenth reserved subset: complete service prerequisites

Six screened tasks use exact-hash complete adapter evidence for oxygen-sensor work, the complete adaptive cycle for 6R80 strategy programming, and the complete 3160 filling procedure/material specification for its temperature sensor. Explicit prospective enrollment includes new, reserved and pair-fallback jobs; prior held/reviewed jobs require explicit retry unless already enrolled. Complete owner ignition evidence accompanies the actual control tasks. Offline preparation retains all evidence: oxygen-sensor and temperature-sensor packages use two packets where required, with normal independent review and isolated fallback. No publication approval follows from reservation or packaging. The secondary tenth subset waits for the ninth subset and its isolated wheel-stud source recovery retry to finish in the same CLI slot.

### Optional cushion context and rear-anchor evidence (2026-10-27)

The exposed G1692226 tongue adjustment must not inherit a fitted-rear-seat prerequisite from its optional cushion reference. The exact primary exception leaves real cushion-access tasks qualified as before; a regression covers both cases.

The G1693753 rear anchor package can enroll complete BrakeSafety and the checksum-bound G1694687 material span ending before Torque Specifications, alongside the matching pad prerequisite. It does not import the conflicting six-piston bleeding row. Existing held/reviewed packages remain unchanged unless explicitly retried or previously enrolled. Offline preparation found one packet but unresolved-reference context, so any targeted retry remains isolated and requires complete independent and supervisory review. All 28 workshop/pair/owner/alignment tests passed.

### Original executable torque-calculator evidence
The oxygen-sensor repair queue exposed a source extraction gap: reference text retained the calculator fields but omitted its original JavaScript. `editorial-workshop-calculator.mjs` supplies complete checksum-bound original script blocks and extracted text for all ten calculator pages, alongside the current Atlas calculator UI/model, using private external evidence nodes. Original HTML remains private. Tests compare actual original straight/crowfoot calculations with the current model across measured-input fixtures; this establishes calculation correspondence, not physical tool fit.

Enrollment is limited to eight exact oxygen-sensor primaries and new, explicitly retried, reserved/fallback or previously enrolled jobs. Existing holds do not silently rerun. Full source figures and per-packet independent reviews remain required. These external sources remain ineligible for the owner-only pair exception. No calculation may assume a universal 303-476 orientation or available 90-degree clearance; the actual complete tool assembly must match the chosen reference form. No runtime calculator behavior changed.

The eleventh secondary reservation contains only two screened tasks: already-removed 5.2L cylinder-head bench work and the four-engine fuel-pressure-release subprocedure. The latter receives the complete hash-bound FuelSafety source and exact owner starting controls through prospective/retry enrollment; bench work does not. Existing held records remain unchanged. The reservation is scheduling only, with full source/figure review and exact supervisory approval still required before publication.

### Eleventh screened secondary reservation
Two tasks are reserved after the current six and isolated oxygen-sensor retries: an already-removed 5.2L cylinder-head bench procedure and the four-engine pressure-release subprocedure. Exact pressure-release primary hashes enroll complete FuelSafety and owner starting controls; removed-head work does not acquire vehicle startup instructions. Existing holds retain prior evidence unless explicitly retried. Offline preparation retains all figures and full source; both tasks still require complete independent and supervisory reviews. All 34 focused tests pass.

### Accessible upper-guide adjustment scope

The secondary twelfth reservation contains only G1726475, untwisting webbing at an already accessible seatbelt guide. Its complete source and both fold/feed figures remain in the review packet; conditional trim access is explicitly a separate prerequisite, and obstructed access stops. This does not authorize retractor repair or restraint-system certification. Full independent review and exact supervisory approval remain required. The secondary promoter now recognizes this reserved manifest.

### New front window motor initialization

The thirteenth secondary reservation uses G1957566 only for a new motor already installed in a fully reassembled coupe. The complete source explicitly skips de-initialization for a new motor. Existing-motor live battery/fuse interruption remains outside this scope. The complete high-force warning, closed door, fully open start, both second-detent holds, extra cycle and one-touch checks remain required, together with independently reviewed owner controls. This is prospective authoring guidance, not publication approval.
