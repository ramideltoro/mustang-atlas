# Local editorial authoring

## Standalone local-only publication

The subsequently authorized standalone program uses local model drafting and local model review without runtime Codex calls. This is a separate publication path; the earlier Codex pilot and its historical measurements below remain historical. It does not relabel local reviews as independent Codex reviews or weaken legacy overlay validation.

`standalone/publish.mjs` exports `publishApproved({root, items, log})`, where each item has `{id, kind, artifact}`. Artifacts contain `id`, `kind` (`reference`, `workshop`, or `care`), `title`, `articleHtml`, nonempty relative `sourceBindings` (`path`, `sha256`), `review`, and `deterministicChecks`. Review provenance must be `kind: "local-model-review"`, name its model, pass with no unresolved issues, and bind the exact candidate and source list. Candidate SHA256 hashes `JSON.stringify({id,kind,title,articleHtml,sourceBindings})`; source-list SHA256 hashes `JSON.stringify(sourceBindings)`. Publisher validation independently rereads every bound source, rejects path/symlink escapes, active HTML and false human/Codex provenance, and rechecks evidence before committing.

Approved artifacts are stored only in `content/local-articles/<id>.json`. The runtime's `/api/v1/local-articles/:id` must return `artifactSha256` computed from exact on-disk bytes, including the final newline. The legacy content, approval maps and media directories remain separate. Deploy the reader support once before invoking this publisher; article publication does not deploy application code.

The publisher uses a temporary Git index and a commit containing only article files, refusing dirty target files or a divergent GitHub main branch. It uses the fallback Git binary and existing `gh-run.mjs` credential wrapper, without copying credentials into artifacts. It stages a full VPS content snapshot using `backend-root.mjs`, overlays only the article files, retains the prior content, swaps directories, recreates the web container and verifies every live artifact hash. Failed activation/readback restores content and pushes a compensating Git commit. Unrelated local changes are preserved. Failed rollback is recorded as `rollback-failed` and retains the local publication lock for intervention; no subsequent batch should proceed until resolved.

Run `node --test standalone/publish.test.mjs` for source/provenance/HTML rejection, staged-source rechecking, rollback at each phase, concurrent modification, and production shell-generation tests. Passing these tests is not evidence that any article was published.

The one-time runtime bootstrap is separate: `node standalone/bootstrap.mjs build --release <privateReleaseDir> --revision <codeCommit>` archives only Docker/package/build files plus server/shared/src/public/compose sources, uploads them and builds a distinct image tag. Production content is copied into the isolated build context; content, data, media, Caddy and DNS are not replaced. The shared publication lock stays held until activation or an explicitly reconciled failure.

After the exact source revision's tests pass, save private JSON evidence `{ "passed": true, "revision": "<codeCommit>" }` and run `node standalone/bootstrap.mjs activate --release <privateReleaseDir> --tests-evidence <evidence.json>`. Activation refuses changed source bytes or a changed current image, retains the prior image, recreates the existing web service, checks health, an existing guide and the new API's JSON 404, and only then copies the runtime source files into the deployment directory. Failure restores the prior image/container and source backup. Archive SHA256, source hashes, revision, image IDs and live-check results remain in the private release manifest. Neither command invokes runtime Codex or changes legacy article approvals.

Runtime bootstrap for code revision `158595c` completed on 2026-11-02 at 22:51:11Z after the coordinator confirmed 427 passing tests, a successful build and the paused authoring app. The live image is `sha256:85e469e15038ea21fa818783633cc17ab0a5c1e4e9d971b5ed4eda61271931d5`; the prior image `sha256:dcb10993d03bfd1c36c60b9d8eb680b5a5487af6345bcafb79e1ac56fdd97038` remains available for rollback. Live checks returned healthy with 2,264 documents, HTTP 200 for `wheel-hubs`, and HTTP 404 JSON `Article not found` for the new endpoint's nonexistent ID. Full archive/source hashes and the test-log attestations are in `work/standalone-runtime/158595c/manifest.json`. This deployed reader support only; it did not publish any new article or alter content, data, media, Caddy or DNS.

## Status and boundaries

The approved migration moves **draft authoring** to the local AI server `chingadera`. Independent Codex review, complete source and illustration coverage, exact-artifact supervisory approvals, and the existing publication gates remain required. Local output is a candidate, not an accepted or published article. Existing holds remain in force.

This runbook was started on 2026-11-02. The coordinator reports the dedicated `mustang-editorial-pilot-20261102.service` active after launch at 21:54Z: the Node worker is drafting with the 14B model, 8,192 context, on CPU (`size_vram: 0`). This is a pilot launch observation, not a completed benchmark, review approval, or production release. No old writer or publisher was restarted during this audit. No content or approval maps were changed.

The intended server is `rami@192.168.1.115`, with isolated runs beneath `/home/rami/mustang-atlas-editorial/runs/`. Credentials remain in the central credentials file; never copy values into prompts, logs, packets, or this document.

## Queue and review flow

1. Export immutable, source-complete pilot packets. Bind each packet to its article ID, source fingerprint, exact source text, complete required figures, and applicable review contract. Preserve exclusions and unresolved dependencies.
2. Prepare an isolated run with `node scripts/local-editorial-server.mjs prepare --pilot work/local-editorial/pilot --run <runDir>`. The controller requires ten distinct pilot articles and refuses to overwrite an existing queue.
3. Once the controller and worker have been validated, deployment uses `node scripts/local-editorial-server.mjs deploy --run <runDir>`. This uploads the isolated run and creates a dedicated system service named `mustang-editorial-<runId>.service`, running as `User=rami`. **This is a documented command, not a record that deployment has occurred.**
4. Inspect with `status --run <runDir>` and retrieve output with `collect --run <runDir>` using the same controller. Collection must not write accepted content, approval maps, or publication directories.
5. Submit the frozen candidate and complete evidence to the separate Codex review adapter. A failed or incomplete review stays held. Preserve original attempts, verdicts, and any later exact corrections.
6. Only a candidate that passes the existing validation and independent approval process can become eligible for the existing publisher. Migration does not authorize starting that publisher or deploying article content.

The dependency-free Node 22 worker is `scripts/local-editorial-worker.mjs`. The inspected controller selects `qwen2.5:14b` and `qwen2.5:32b`, eight inference threads, an 8,192-token context, up to 3,072 generated tokens, temperature 0.3 and seed 42. It requests Ollama through server loopback port 11434 only, with one request at a time. Runtime records include installed model digests and Ollama version. Resume must verify packet hashes and successful validation before reusing results.

The system service's `MemoryMax=2G` and `Nice=10` constrain the Node coordinator, **not Ollama inference**. Eight threads are passed as Ollama's `num_thread`; there is no dedicated hard CPU/memory cap or priority reservation for inference. The inspected worker waits for at least 12 GiB available memory and load average at most 10. A foreign loaded model is recorded while waiting but does not itself block execution: loaded does not prove busy. These checks are not an exclusive lock on other applications. It probes the existing wrapper at loopback port 8788 before and after calls and records health-endpoint latency, memory and model token counters. Endpoint readiness and probe latency do not measure production inference latency. An unhealthy wrapper blocks the whole run for investigation; cached packet reuse requires matching fingerprint, no recorded validation errors, and a successful post-call health check. Preserve existing services and investigate any unhealthy result before expanding the run.

An 8,192-token context is not permission to truncate sources, omit figures, or mark unread tails complete. Oversize packets need an explicit complete chunking/review plan or a hold. The inspected local author request is text-only and sends no images; it cannot claim direct figure coverage. Preserve complete originals for independent Codex review, and treat any image-dependent drafting gap explicitly.

Parent server inspection reports Ollama 0.30.10, 58 GiB RAM with about 55 GiB available, and about 1.6 TB free. A separate existing `llama-server` was consuming roughly 500% CPU. These are reported preparation observations, not repeated measurements by this documentation audit. Operate with load awareness and do not stop, replace, or reconfigure that service.

## Read-only inventory audit

Counts were independently reconstructed on 2026-11-02 from `content/workshop-guides.json`, `content/maintenance-guides.json`, `work/editorial-references/inventory.json`, and `content/guides/*.json`. Practical publication flags are `authoring.independentTechnicalReview` or `authoring.independentSourceReview`; reference publication is `referenceEditorialVersion === "enthusiast-v2"`.

| Article family | Unique inventory | Published editorial versions | Unpublished |
| --- | ---: | ---: | ---: |
| Workshop | 902 | 273 | 629 |
| Care / maintenance | 48 | 42 | 6 |
| Reference | 2,264 | 790 | 1,474 |
| Total | **3,214** | **1,105** | **2,109** |

There are no duplicate IDs across these three inventories. They remain separate article types even where their underlying manual documents overlap. The secondary workshop-care writer operates on the same 902 workshop jobs: its inventory, 125 ledger entries, and historical review totals must not be added as another article backlog.

The last local release manifest is `work/editorial-releases/20261029T042252Z-editorial/manifest.json`, status `live`, verified 2026-10-29T04:23:31.683Z. It reports 315 practical plus 790 reference editorial versions, total 1,105; its `guides: 950` field means the complete practical catalog (902 + 48), **not** an additional published count. The associated supervisor live checks are retained beside it. This audit corroborates the local released snapshot and does not claim a fresh November 2 production HTTP verification.

Three existing detailed care guides lack the newer authoring flags and are excluded from new authoring: `wheel-hubs` (18 steps), `3-7l-v6-head-gasket` (39), and `3-7l-v6-timing-chain` (42). Their presence and step counts were verified in `content/maintenance-guides.json`; the same explicit exclusions appear in `scripts/editorial-progress.mjs` and `scripts/care-editorial-author.mjs`. Thus **2,109 is the subtotal without the newer editorial flags; 2,106 is the authoring remainder after those three priorDetailed exclusions** (629 workshop + 3 care + 1,474 reference). The table's published count deliberately measures the newer editorial versions, not every previously detailed live guide. Preserve these IDs in the new queue exclusion manifest. Neither remainder is a count of ready-to-publish articles.

Raw reference state has 795 accepted, 188 held, and 1,281 pending, totaling 2,264. The ready manifest contains 767 nonbaseline documents plus 23 baseline published references, totaling 790. Raw acceptance is not publication permission: exact revisions, historical fingerprints, and supervisory holds can make raw state disagree with selected publication artifacts.

The workshop ledger contains 592 IDs: 294 reviewed, 287 needs-review, nine reserved, one failed, and one reviewing. The secondary ledger contains 125 IDs: 96 reviewed, 25 needs-review, and four failed. These historical statuses overlap published/revised artifacts and each other; do not sum them into a new unique backlog or assume their apparent active entries have live processes.

## Process conflict check

On 2026-11-02, `ps` found no old editorial writer, release publisher, or `codex exec` process. The recorded PIDs 66444 (main), 82074 (references), and 57758 (publisher) were absent. Their progress files still say running but were last updated around 2026-10-29T06:48–06:50Z; these are stale records.

`work/editorial-workshop/worker.pid` still contains 66444. The checked reference worker PID/lock files were absent. No stale file was deleted. Before any authorized future startup, repeat process and lock checks, validate process identity rather than trusting a PID alone, and retain the old state. Do not run old and new authors concurrently against the same mutable queue. The old publisher had `pending: 0` in its final recorded progress; that is historical, not a live November 2 observation.

The implementation uses the existing bundled Git runtime because Apple Git requires Xcode license acceptance. No developer-tool configuration was changed.

## Comparable Codex token baseline

The following is a **historical completed-call footer baseline**, read on 2026-11-02. It extracts only standalone `tokens used` lines followed by an integer from `.log` files in the named roots. All 2,812 matched call headers identify `gpt-6.1-sol`. Incomplete/error logs without that footer contribute no token measurement; zero contribution does not mean zero usage. No prompts or credentials are reproduced.

| Log root | Author calls | Author tokens | Median author call | Review calls | Review tokens | Median review call |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `work/editorial-workshop/jobs` | 609 | 22,778,574 | 37,771 | 607 | 21,639,098 | 35,135 |
| `work/editorial-workshop-care/jobs` | 178 | 6,076,894 | 32,977 | 178 | 5,729,276 | 30,985 |
| `work/editorial-references/documents` | 41 | 994,417 | 26,160 | 27 | 605,085 | 20,984 |
| `work/editorial-references/shared-jobs` | 799 | 57,710,352 | 75,208 | 373 | 22,133,307 | 60,051 |
| Total | **1,627** | **87,560,237** | — | **1,185** | **50,106,766** | — |

Combined measured total: **137,667,003 footer tokens**. Each matched file contained one footer. This is not the complete account/project usage: it excludes interactive supervision, other log roots, and unmeasured failed calls. Retries and historical attempts are deliberately included as actual observed call work. The two reference roots are disjoint standalone versus shared invocation directories; per-document output files from shared jobs are not counted again.

These footers do not expose a reliable input/output/cached-token breakdown or monetary charge. Do not convert them to API cost, a subscription percentage, or a claimed savings amount. A shared reference call can contain multiple articles/chunks; its aggregate cannot be attributed to one document by division without verified batch membership.

For the pilot comparison, freeze the same article IDs, source bytes/fingerprints, figure set, chunk boundaries, and output contract. Record local model tag/digest, prompt size, output size, server-reported prompt/evaluation tokens, elapsed time, retries, and review result. Compare against matching historical Codex calls where available, retaining whole-batch attribution for shared calls. Report drafting throughput and independent-review pass/hold results separately. The retained Codex review cost and any corrective drafting must remain visible; replacing author calls does not eliminate review usage.

The preparation manifest at `work/local-editorial/pilot/manifest.json` supplies the following directly attributable historical first-attempt logs. These numbers were independently reread from its `priorCodexLogs` paths; they are a starting reference, not a completed equal-work benchmark. New packet boundaries and prompts differ, and the pilot has not demonstrated equivalent quality or savings.

| Pilot ID | Historical author footer | Historical review footer |
| --- | ---: | ---: |
| `job-2c89743db16dc16f` | 25,008 | 15,582 |
| `job-066d1204854b4ef3` | 16,716 | 30,061 |
| `job-ff37ef956cb4639d` | 24,956 | 37,522 |
| `headlamp-switch-contact-testing` | 31,216 | 29,142 |

The reference pilot entries instead link shared author calls: G1696472 (56,189), G1687313 (35,113), C128 (68,049), G1692149 (81,032), and three G1693189-associated calls (54,197; 48,998; 54,999). Those figures belong to entire shared invocations, not solely the named article. C313 has no matched prior log in this preparation manifest; do not impute zero authoring cost. Retain exact manifest/source hashes with final pilot results because preparation packets may still change.

## Acceptance before expanding beyond the pilot

### Preparing a bounded local revision

Run `node scripts/local-editorial-revision.mjs --run <mainRun> --job <id> --model qwen2.5:14b --feedback <exact-review-directory>/feedback.json` (or the approved 32B tag). This command performs no inference, deployment, review approval or publication. It creates a private sibling directory `<mainRun>-rev<N>-<modelSlug>-<jobId>` with a single-model/single-job queue, the unchanged source packets, prior candidate, exact review feedback and provenance. An optional `--output` selects a new isolated directory; use the default for revision one if a second revision may be needed, because the second-revision provenance lookup uses that deterministic path.

Only a completed `revision-required` review with `revisionAllowed: true` can authorize this operation. Accepted candidates, review failures, missing-evidence holds, stale candidate/source/image/report hashes, modified feedback and a third revision are refused. The previous candidate is stored once as `initialDraft`; `revisionInstructions` are appended by the worker only to the final packet. The preparer checks the prior draft plus every source packet and final instructions against the worker's context-byte budget. If they do not fit, it refuses instead of truncating or silently dropping evidence. Later draft growth remains subject to the worker's per-call check. Original queues and caches are untouched.

Run `node --test scripts/local-editorial-revision.test.mjs` for the preservation, provenance, budget and refusal tests. A prepared revision must still be explicitly dispatched and independently reviewed; its `publicationEligible` remains false.

- Verify the isolated worker and controller, their resume/hash checks, and failure behavior without changing the old queues.
- Inspect complete local candidates and required source/figure coverage through independent Codex review.
- Confirm that invalid, oversized, incomplete, or held candidates cannot enter accepted maps or publication paths.
- Record actual pilot measurements and failures; retain a rollback path consisting of stopping the isolated worker without modifying old artifacts.
- Expand only after the pilot has demonstrated both technical completeness and the intended reduction in authoring demand. Do not infer quality from speed or model size.

## Active pilot and controllers

The immutable drafting queue is `work/local-editorial/pilot-20261102/queue.json`, built from `pilot-final`: ten article IDs, 45 complete evidence packets, tested under both models (90 planned initial model calls). Original diagram inspection is performed by Codex. Review-only corrections to image inventory and the source-once prompt are documented beside the frozen export; author prompts, source text and schemas were preserved.

The dedicated server service is `mustang-editorial-pilot-20261102.service`. The new worker directory is `/home/rami/mustang-atlas-editorial/runs/pilot-20261102`. State and model outputs remain private. A shared drafting lock prevents simultaneous Mustang inference workers across main and correction runs. The service starts on boot and resumes valid packet checkpoints.

The serial review/correction controller runs with `node scripts/local-editorial-orchestrate.mjs --run work/local-editorial/pilot-20261102`. It saves its own state, collects remote artifacts, performs source/image-bound Codex review and dispatches at most two local correction runs. It holds individual context failures and blocks on infrastructure/authentication failures. Restart the same command after resolving a recorded operational block; exact review caches prevent duplicate completed calls. The Mac coordinates signed-in cloud review and SSH only; no local LLM is installed or run there.

Use these readouts from the repository:

```sh
node scripts/local-editorial-server.mjs status --run work/local-editorial/pilot-20261102
node scripts/local-editorial-server.mjs collect --run work/local-editorial/pilot-20261102
node scripts/local-editorial-review.mjs summarize --run work/local-editorial/pilot-20261102
node scripts/local-editorial-report.mjs work/local-editorial/pilot-20261102
```

The comparison requires every benchmark disposition, at least eight approved articles per qualifying model and a correct evidence hold for the deliberately incomplete case. It ranks qualifying models by observed accepted-article throughput; it does not authorize rollout or publication. Token savings remain unmeasured until a complete comparable historical baseline is available. The sole publisher is not restarted during this pilot.

An initial inference request exposed Node fetch's separate 300-second headers timeout. Native loopback HTTP now applies an explicit 60-minute inference deadline. The infrastructure-only failed attempt was archived and reset without changing evidence, model settings or accepted drafts; its recovery record remains in the server run directory. This is not a model-quality failure or a completed benchmark result.

To stop this pilot, stop only its dedicated system service and review controller. Preserve the run directory and existing published content for resumption. No existing AI service, model, route or authentication configuration was replaced.
