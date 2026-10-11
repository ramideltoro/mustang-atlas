# Circuit explanations

`server/circuit-context.mjs` exports `createCircuitContextCatalog(db, {contentDir, dataDir, learningContexts}).forDocument(documentId)`. It adds structured context to wiring articles without modifying source blocks, diagrams, existing learning contexts, or vehicle metadata.

The public object provides `title`, `summary`, `scope`, `mode`, `components`, `circuits`, `connections`, `continuations`, `readingGuide`, and `coverage`. Curated contexts can also supply `engines`. Component `connectorIds` and `documentIds` are parallel arrays; a missing local connector has a null document ID. Connector links, circuit functions, cavity numbers, wire colors, and equipment qualifiers remain available to clients.

## Extraction and evidence boundaries

The extractor reads the canonical SVG. `COMP_`, `CONN_`, `CIRC_`, `CUTWIRE_`, `PAGEREF_`, `GROUND_`, and `SPLICE_` groups identify explicit drawing content. A `CIRC_` group ID can contain an instance suffix that is absent from its visible circuit label. Matching uses the actual printed label, never a suffix-stripping guess. Repeated circuit labels merge all printed wire colors. A group containing multiple circuit labels does not assign its colors to individual circuits. Unnumbered conductors stay unnumbered.

A connector terminal is included only when its exact cavity is drawn and its connector-table circuit number is printed on that sheet. Alternative assignments retain their qualifier. The presence of the same circuit label identifies related terminal records; it does not prove a continuous wire path, shared variant applicability, current direction, switching logic, or a safe test method. Automatic contexts therefore have no invented `connections` and set `coverage.topologyVerified` to false. Missing or conflicting records stay unmatched.

`CUTWIRE_` descendants supply true off-page continuations. Ground references and component/location references are labeled separately. Their hyperlinks do not imply additional wire connections. Component roles use the existing source-checked learning context for the exact local connector. Headers are quoted as drawing headers; no generic inference promotes a local branch label into vehicle-wide fitment.

## Visually authored connections

`content/circuit-contexts.json` contains authored additions. Each entry requires the current document hash, actual SVG SHA-256, and current hashes for all supporting document references. Invalid evidence falls back to the extracted map. Private hashes and source references are removed from the public object.

The first complete traced example is `wiring-033-002`, the 2.3L active grille shutter circuit. Original sheets 33-2 and 33-1 were visually inspected. Its three paths are:

- F42, 15 A in the battery junction box, through S112 and continuation A to C1651 cavity 3 on CBK03 gray.
- PCM C1551B cavity 50 to C1651 cavity 2 on VDN06 white/green, carrying LIN command and feedback.
- C1651 cavity 1 through S128 to G104 on GD120 black/green.

The shutter operation articles support the distinction between actuator power and two-way LIN communication, commanded blade movement, and normal startup calibration. The 2.3L heading is a whole-sheet heading on 33-2. C1651 is a four-cavity connector with only three assigned cavities. Fan-motor paths on 33-1 remain separate.

## Coverage and validation

At implementation, all 382 wiring references load successfully. There are 311 circuit sheets (one visually authored, 310 extracted) and 71 location/reference sheets. Across circuit sheets the map exposes 2,169 distinct per-sheet circuit rows and 5,512 connector-terminal references. All 311 circuit sheets have matched terminals. There are 317 unmatched drawn pins; these are not silently repaired or assigned guessed functions. The 2,850 reference links include circuit continuations, component references, and ground references; they are not all wire edges.

Only the authored example claims visually verified topology. Global extraction adds exact labels and terminal associations to the existing topic explanations; it is not a complete schematic netlist or automatic electrical diagnosis.

Run `node --test tests/circuit-context.test.mjs`. Tests cover visible versus internal circuit IDs, repeated colors, exact cavity/circuit matching, qualifiers, real continuations, ambiguous groups, unassigned terminals, private provenance, stale evidence, missing vectors, and cached-result isolation. Canonical SVG reads are lazy and cached; workshop block bodies are not loaded into this catalog.
