# Enthusiast editorial rollout — October 26, 2026

This is an incremental rollout, not a completed rewrite of the entire library. The queue comprises45 older core care guides,902 workshop guides and2,264 public reference articles. The earlier wheel/hub diagnosis,3.7L head-gasket and3.7L timing-chain walkthroughs remain intact.

## Initial reviewed changes

- Cabin-filter replacement: seven steps in three phases, complete lower-dashboard access and reassembly, four findings/next-check rows and three completion checks.
- Front stabilizer link replacement (`job-9bf5ab87a1dfae3f`): eleven steps in three phases, actual wheel-off access, stud restraint, new nuts, wheel reinstallation and recheck. Tone includes natural mild profanity without changing technical instructions.
- Rear suspension overview (`G1686641`): component relationships and original enthusiast explanations.
- Starter connector (`connector-C197B`): cavity-to-row reading method, circuit/color/gauge/function interpretation and view limits.
- Audio/navigation wiring (`wiring-132-001`): separate power, ground, network and rear-video paths; coupe qualifier remains attached to the relevant splice.
- Thirteen system introductions and their concept explanations establish the same friendly, practical voice. They are not counted as full article rewrites.

Each of the five article revisions has a separate automated technical review; none is described as human-reviewed. Source diagrams for wiring and connector review were checked against complete local PDF exports. Transparent image attachments were corrected to white backgrounds so black labels remain readable.

## Reader improvements

Reviewed introductions are now visible even when older background context exists. Optional background remains available in a disclosure, and contents links open it before focusing the target. List-item teaching explanations that the renderer previously omitted are now visible, with normal glossary support. Private review fingerprints remain excluded from the public API.

## Applicability correction

The standard central-nut front hub (`G1692537`) is limited to2.3L/3.7L/5.0L; the separate bolt-on SVT hub (`G1692554`) is5.2L. The findings are bound to the exact reviewed source hashes. The standard guide now links to the separate SVT guide. This scope-only correction is not counted as a rewritten article. It prevents applying the standard340Nm hub instruction to the SVT133Nm bolt arrangement; corresponding standard/SVT brake procedures remain separate.

## Validation and publication

Local catalog validation retains950 guides with zero errors, verifies the new articles and unchanged prior detailed walkthroughs, and checks that incompatible hub configurations withhold procedures. Automated tests include source completeness, units, identifiers, unsafe markup, reader visibility and private-metadata checks. Browser checks cover the rewritten reader, background navigation and phone-width layout without horizontal overflow.

Publication status and exact rollback details will be recorded after activation. Pending or held drafts stay private; the original A/C-belt pilot is held for terminology/prerequisite reconciliation. Use `node scripts/editorial-progress.mjs` for local staged/merged counts. A local merge does not itself prove live deployment.

A follow-up comparison also separates fourteen standard/SVT body references covering splash shields, hood, front/rear bumper covers and front bumper access. Five existing guide applicability records were narrowed accordingly. These are scope corrections, not prose rewrites. Distinct attachment layouts, splitter/duct/tether operations and fastener groups establish the differences; equal torque values alone do not make procedures interchangeable. Later-build or equipment-specific branches remain subject to their documented qualifiers.

## First publication verified

Published through commit `39b752393c4b1c9a95ccf77e7a4782afc652ddc5`. [GitHub CI 40435896370](https://github.com/ramideltoro/mustang-atlas/actions/runs/40435896370) passed all289 tests. The application image was built from3e6df2c;39b7523 supplies the separately mounted final content correction for pilot-bore cleaning. Production-database validation passed before activation. Live health, cabin-filter and stabilizer phase/step counts, revised-reference visibility and incompatible hub withholding passed afterward. The container reports healthy.

Image: `sha256:fb33ced49848c1625693706f6f886dcc74ee3a8283e5f11d6c9df26cc12c6698`.
Rollback source/content archive: `/srv/mustang-atlas-rollback-20261026-editorial/source.tar.gz`.
The exact previous content directory is retained at `/srv/mustang-atlas-rollback-20261026-editorial/content-before-activation`.
Previous image: `mustang-atlas-web:before-20261026-editorial`.
Restore matching source/content and image together. No database, media, Caddy or DNS changes were made.

Only the five named article rewrites, thirteen system introductions, reader changes and scope corrections are part of this publication. Further author/reviewer batches continue into private staged files. In particular, an oil-service draft was withheld after supervisory review found that it imported excessive access prerequisites from oil-pan removal; an automated pass did not override that finding. Do not merge staged results without checking applicability, actual access, observations, decisions, source evidence and reader-facing tone.
