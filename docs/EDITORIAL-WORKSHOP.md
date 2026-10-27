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
