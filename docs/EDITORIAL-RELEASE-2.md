# Editorial release 2 — October 27, 2026

Publishes the reviewed backlog:17 care guides,12 workshop guides and20 reference articles, bringing this pass to54 published article rewrites after activation. This does not mean the sitewide task is complete. Source hashes and the exact20-reference publication manifest were verified before merging; corrected reference revisions supersede earlier drafts. The catalog retains950 guides with zero validation errors.

Reference heading explanations now render separately below concise headings instead of being silently discarded. Existing paragraph/list explanations remain visible. The20 references include camera, cruise, starting, windows, engine controls, restraints, warning chimes, charging, brake precautions, blind-spot monitoring and connector reading guides.

Care coverage includes oil-level checks, lighting, cooling checks/leak tests, battery testing, transmission fluid service, clutch bleeding, axle/driveshaft/boot inspections, exhaust, latches, spark plugs and stabilizer bushings. Workshop coverage includes the distinct standard/SVT front hubs, suspension links/bushings/bar, TPMS activation and brake pad/disc variants. Rewritten guides include source-supported access and reassembly, observations/decisions and completion checks. Scope limitations remain explicit; held drafts are not part of this release.

Local tests and production build pass. Full-catalog checks preserve prior detailed wheel/hub, head-gasket and timing-chain walkthroughs and incompatible-engine withholding. Publication and rollback verification are recorded after activation.

Published and verified: commit `afd1b2f024c5c0eaedfe86cbcfef0c9d112df5e5`, CI [40491301215](https://github.com/ramideltoro/mustang-atlas/actions/runs/40491301215). All49 new public API routes passed post-activation checks. Production validation confirms31 rewritten practical guides plus23 rewritten references,54 total, with950 guides retained and no catalog errors. The prior three detailed walkthroughs are additional preserved work. Local291 tests and the build passed; connector heading explanations were verified in the browser.

Rollback: `/srv/mustang-atlas-rollback-20261027-editorial-2/source.tar.gz`, its `content-before-activation` directory, and `mustang-atlas-web:before-20261027-editorial-2`. Active image `sha256:1c34dc3201b8fe6826e61a01ce5ff0e20d3fbbb44aa15cad5330acbd98972f30`. No database, Caddy or DNS modifications.

The remaining workshop queue now runs without an article limit; diagnostic references no longer recursively import unrelated teardown instructions. The reference queue groups up to four small documents per author/reviewer call while retaining individual source identity and validation. Held care articles are being resolved from supporting evidence. Only accepted, validated records are eligible for subsequent publication.
