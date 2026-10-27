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
