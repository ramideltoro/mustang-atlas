# Wheel and hub diagnosis walkthrough

Revised October 26, 2026 at `/#/maintenance/wheel-hubs`. The previous page had three generic instructions and delegated the actual diagnosis to links. The replacement gives 18 written steps in five phases, eight finding/meaning/next-check rows and four verification checkpoints. It remains in chassis maintenance, with task type Diagnostics and difficulty Intermediate; the optional brake-off branch is explicitly advanced.

## Scope and evidence

The documented scope is the 2015 U.S. Mustang with 2.3L, 3.7L or 5.0L and factory wheel-end arrangements. The separate SVT brake/hub procedures and aftermarket arrangements are excluded from the optional brake-access specifications. Twelve current source-bound workshop references cover suspension, tire/wheel and noise diagnosis, lifting, wheel installation, brake drag, front/rear disc access, front/rear hub repair, steering and ABS diagnosis. The original schedule evidence is preserved.

The hand checks are supported by Timken LV3; Timken LV5 supplies general symptom context, and MOOG explicitly notes that some noise only appears while driving. Public links were checked October 26, 2026. Supplier examples are not treated as automatic replacement rules, clearance specifications or a Mustang bearing replacement interval. No paid AI API calls were used.

The article distinguishes wheel movement on studs, hub movement relative to knuckle and movement at suspension/steering connections. It does not assign a failed part from hand position, noise location or steering direction. It preserves the difference between endplay and runout, explains unloaded-test limits, excludes power-driven raised-wheel testing and does not supply a guessed bearing clearance limit. Dangerous conditions stop the road-test path. Brake work requires restoring the assembly and pedal operation before movement.

Checked numerical instructions: standard wheel nuts 204 Nm / 150 lb-ft, clean dry threads, star pattern, final tightening on tires and recheck within 100 mi / 160 km (G1686507). Standard front caliper mounting 115 Nm / 85 lb-ft with new bolts in the 4/6-piston branches (G1693784); standard rear caliper/anchor-plate mounting uses new bolts at 175 Nm / 129 lb-ft (G1693754). These are not hub or spindle-nut specifications. Central hub/spindle fasteners stay undisturbed during the diagnostic checks.

## Presentation

`src/WheelHubChecks.jsx` provides an original theme-aware wheel/hand-position illustration, accessible 3/9 and 12/6 buttons, a text explanation and links into the actual steps. The route cards lead to safety/ground checks, supported checks and the decision table. The illustration describes grip locations, not lifting points, measured movement or physical component geometry. All actual inspection instructions remain readable without using the controls. The article uses an original wheel thumbnail instead of the old manual image.

The visual is validated against the lifting, wheel installation, suspension and brake sources and is withheld for incompatible engine/year selections. The source validator permits multiple supported engines for this visual while retaining the single-engine restriction for the existing head-gasket and timing-chain visuals. New glossary entries explain bearing endplay, runout and brake drag.

Direct links: `?section=wheel-supported-checks`, `?section=wheel-brake-isolation` and `?section=diagnostic-decisions`. Steps are consecutive and the mobile contents menu collapses.

## Validation

All 272 automated tests and the production build pass. Targeted catalog checks report 950 guides and zero errors, verify 18 steps/five phases/12 workshop references/three public links/eight diagnostic rows, preserve both Special maintenance walkthroughs, confirm search aliases and reject incompatible scope. Private source metadata is excluded from the public guide. The existing full corpus audit was not rerun for this focused revision.

Browser checks cover desktop and 390/320px layouts, hand-position controls, section/step jumps, the endplay glossary popup, decision-table rows and incompatible-engine withholding. A broad SVG rule initially enlarged the button arrow and caused narrow-screen overflow; it was narrowed to the figure SVG and the 320px layout rechecked without overflow. No browser console errors were observed.

## Deployment

Deploy the application plus both content files together. Keep a matching rollback source/content archive and Docker image because content is mounted separately. No database, media, Caddy or DNS changes are required.
