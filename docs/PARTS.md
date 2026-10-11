# Parts and diagrams

`server/parts.mjs` exports `createPartsCatalog(db, {contentDir}).forDocument(documentId, {year?, engine?})`. It reads the existing parsed article data and the curated `content/parts-catalog.json`; it never changes articles, generated explanations, source hashes, or media. Unknown document IDs return `null`.

The public result contains `availability`, `parts`, `identifiers`, `diagrams`, `catalogLinks`, and `fitmentNote`. Availability distinguishes verified parts, reference identifiers/diagrams, and unavailable content. There is no generic VIN lookup link or missing-part message. The reader omits the entire section and its navigation entry when there are no parts, identifiers, or diagrams. Product-specific application notes remain alongside confirmed numbers. The API integration applies the existing media-quality resolver to diagram URLs.

## Verified numbers

Service entries require primary Ford evidence and explicit application data. Ford's 2015, 2016, and 2017 published tables establish historical Motorcraft applications, not current supersessions, factory-installed part identity, or universal fitment. Year and engine filters narrow these applications. The two 5.0L spark-plug numbers remain separate by publication year. The GT350 spin-on oil filter is explicitly inapplicable to the cartridge housing.

Ford's product pages independently establish these number pairs:

- [FL500S / AA5Z6714A](https://www.ford.com/product/engine-oil-filter-p4000147027).
- [FL910S / BE8Z6731AB](https://www.ford.com/product/engine-oil-filter-p4000059732).
- [WPT930 / 9U2Z14S411DA](https://www.ford.com/product/speaker-connector-p4000110567).

The C226A pigtail application is additionally bound to the exact connector article hash and its service-parts row: kit 930, silver terminals, 12 cavities, service number 9U2Z-14S411-DA, and housing 9U5T-14489-JA. It is a connector repair part, not a replacement SCCM. The catalog's generic “Speaker Connector” product title does not change that local application. Its unknown year/engine range stays empty and its status requires vehicle confirmation. A changed article hash invalidates this mapping.

Ford UK's [2.3L clutch slave cylinder](https://shop.ford.co.uk/products/mustang-2-3-4v-ti-vct-clutch-slave-cylinder-2015) is catalog number 1926512; the seed explicitly labels its UK scope and does not invent a North American interchange. The [rear halfshaft inner bearing](https://shop.ford.co.uk/products/mustang-rear-axle-half-shaft-inner-bearing-03-2015) is linked for application checking only because its public listing does not expose enough equipment qualifiers to verify a local ordering recommendation.

Private evidence URLs, publication locations, article hashes, and inspection records are retained only in the catalog file. Public links lead to Ford product or catalog pages. No prices, stock promises, inferred supersessions, or aftermarket interchanges are supplied.

## Identifier extraction

Only labeled tables establish identifier meaning. The resolver distinguishes:

- Base/family numbers in component and harness tables. A number such as 6700 does not establish the prefix or suffix needed to order a particular seal.
- Connector housing, terminal, and unverified service identifiers. Formatting alone cannot establish orderability.
- Material codes and required material specifications.
- Special-tool and tool-kit identifiers, including historical tool designations.

Numbered diagram callouts are retained separately. Blank/em-dash/N/A fields are not part numbers. A service identifier already verified in a part card is removed from the unverified list to prevent contradictory labels. The original engineering housing identifier remains available.

## Diagram selection

The panel returns at most three original images. Visually reviewed exploded illustrations are preferred, followed by the article's own useful illustrations or a component-matched assembly in the exact same engine section. A related diagram must match all meaningful component-name tokens; a nearby article is insufficient. Curated cross-article links bind both target and diagram-owner hashes.

Only four visually inspected illustrations currently receive `explodedVerified:true`: the 2.3L front/upper engine, 3.7L upper engine, 5.0L lower/front engine, and steering-column/shaft assembly views. Other illustrations retain accurate component, procedure, connector, or wiring labels. Tool thumbnails, tiny non-connector graphics, and symbol-guide images are excluded. A selected engine excludes known conflicting diagram variants. All original article media remain available in the article itself.

## Evidence conflicts deliberately withheld

The Ford 2015 online parts table lists a cabin filter that conflicts with later Ford publications. No 2015 cabin-filter fitment is asserted. The 2016 and 2017 publications reverse the wiper-side assignments; the seed uses the explicit 2017 assignments only and does not infer 2016 fitment. These are evidence gaps, not reasons to silently choose a plausible number.

## Validation and coverage

Run `node --test tests/parts.test.mjs`. Eight focused tests cover identifier classes, callout separation, year/engine scope, stale diagram evidence, exact related assemblies, connector identity, bounded media selection, manual-transmission wording, missing evidence, and stale pigtail mappings.

The initial 2026-10-11 parts audit checked 2,265 article results: 18 verified catalog records served 33 articles; 732 articles contained classified identifiers; 1,880 received useful bounded diagrams; 43 included a visually verified exploded illustration. Subsequent public catalog cleanup excludes the exporter-only introduction. Generic VIN-catalog links and missing-part notices have been removed, and unverified articles do not claim a service ordering number. Zero private-source/hash leaks were found, and no result contains more than three diagrams. Coverage describes known evidence rather than a complete Ford electronic parts catalog. Procedure illustrations render without the generic “Assembly detail” label.
