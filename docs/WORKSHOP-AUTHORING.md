# Workshop guide authoring

`content/workshop-guides.json` supplements the 46 maintenance guides without replacing them. These technical guides explain a practical diagnosis, repair or overhaul and link every applicable full procedure. They do not introduce maintenance intervals. `content/workshop-coverage.json` records what is covered, still pending, a local referral, or an external diagnostic dependency.

## Evidence and scope

The inventory covers public repair/diagnosis documents and separately identified technical chapters classified differently by the original importer. The plan reserves the generic engine-diagnosis and oil-filter-inspection sources for nine curated engine-health guides. Referral-only documents are distinguished from substantive local diagnostic articles; an external diagnostic dependency is never counted as an authored test. Use the locally generated coverage inventory and current audit for exact accepted/pending counts; an incomplete inventory must never be presented as complete coverage. The inventory includes unsupported-scope notes and is excluded from public Git history, deployment, and API responses.

Practical jobs combine matching engine variants and procedure phases while keeping MT82, TR3160 and 6R80 work separate. Long diagnostic chapters split only at named pinpoint-test boundaries. Coverage offsets refer to the exact stored `documents.text` string: start inclusive, end exclusive. The planning test reconciles every source character; no silent excerpt truncation is allowed. Curated engine-health coverage instead explicitly identifies supported Mustang branches, without claiming an artificial whole-source span over unrelated Ford applications.

An explicit same-task map reuses existing maintenance content for its supported engines. Merely linking a repair article from an inspection guide does not establish repair coverage. Remaining engine variants stay in the queue. SVT Performance Package titles are scoped to 5.2L; the 307-02 automatic-transmission cooling chapter is scoped to the base-engine 6R80 applications. Other branch conditions remain local to their procedure.

## Running and resuming

Run from the repository directory:

```sh
node --test scripts/workshop-author-selftest.mjs
node scripts/workshop-author.mjs --concurrency 6 --batch-size 6 --batch-chars 100000
```

`--prepare-only` writes an inventory and publication without starting Codex. `--limit 12 --batch-size 4` runs a bounded pilot. The default batch evidence limit is 80,000 characters; larger individual jobs run alone. No model or reasoning override is set. The worker uses the locally signed-in Codex CLI and supplied local evidence, never API keys or an application-level model API. Key environment variables are removed from child-process environments.

Progress is in `work/workshop-author/progress.json`; the PID lock is `worker.pid`. Complete job evidence, source fingerprints, attached original images, raw outputs and held reasons are retained under `jobs/batch-*`. Accepted checkpoints live under `accepted/job-*.json`. Current fingerprints bind source hashes, exact spans, engine scope and editorial version. A restart reuses valid accepted work and queues remaining jobs. The parent must run this in a retained terminal/session or detached process; an optional `caffeinate -i -w PID` prevents idle sleep while the local worker runs.

Create `work/workshop-author/stop-after-current` to stop after active jobs finish; remove it before resuming. SIGINT and SIGTERM also request a graceful drain. Account usage limits cause a 30-minute backoff and requeue, not editorial failure. Authentication failure stops with an explicit attention state. Invalid or ambiguous drafts stay held/pending with their output intact for correction or a subsequent authoring attempt.

## Publication and review

Each accepted guide is checked for required teaching sections, exact source-span coverage, valid procedure IDs, source-bound inspected hero candidates, and unsupported numeric tokens. Original images are selected through established thumbnail/control exclusions. These mechanical checks cannot prove semantic accuracy; independent source review is still necessary. Generated guides are never labeled human-reviewed.

Reviewed curation is preserved in tracked `content/workshop-curated.json`. Local incoming edits in `work/workshop-health.json` and `work/workshop-curated.json` are reloaded on publication; promote accepted corrections to the tracked catalog so a fresh checkout retains them. Reviewed job overrides bind the current job fingerprint and exact evidence spans. `content/workshop-evidence.json` records separately verified local-reference corrections and diagram transcripts bound to their original article/media hashes. `content/workshop-media-overrides.json` keeps visually reviewed component-image choices; it does not generate or modify technical artwork.

The publisher replaces each catalog/coverage file atomically, and the release validator reads and checks them as a stable pair. Related guides come from actual chosen supporting procedure links and exact related article references, with engine intersection; sharing a large diagnostic chapter alone does not justify a recommendation.

Only accepted guides count as covered. Pending jobs and external dependencies remain visible in operational audits. Coverage counts refer to source-document scope, not a claim that every linked article has been manually reviewed or that a beginner can execute specialist work without its required equipment.
