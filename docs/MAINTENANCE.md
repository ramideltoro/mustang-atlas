# Component maintenance guidance

`server/maintenance.mjs` exports `createMaintenanceCatalog(db, {contentDir, guideResolver?}).forDocument(documentId, {engine, year})`. The default year is 2015 and default engine is `all`. An article without a supported matching rule returns null; it does not receive a made-up service interval or generic maintenance checklist.

`content/maintenance.json` centralizes 29 authored rules. Each item supplies what to do, when, why, notes, applicability and official Ford links. The public result is `{documentId,title,scope,items}`. Item fields are `{id,title,kind,what,when,why,steps,notes,applicability,sources}`. `kind` distinguishes scheduled replacement, routine inspection and condition-based care. Provenance hashes and mechanical evidence document IDs are private.

Items now also include `guideHref` when a valid, compatible detailed guide maps to the rule. All public references to the normal schedule resolve to `#/maintenance/schedule` with the label “Normal maintenance schedule”; clicking them stays in the site. Exact evidence URLs remain in the private seed for verification. See [the maintenance library](MAINTENANCE-GUIDES.md) for full guide and schedule authoring.

## Applicability and source checks

Rules match exact document IDs or bounded component-title expressions combined with chapter codes and article kinds. They never search body text for maintenance keywords. A referenced procedure, a connector pin description, a safety-belt title, or a coolant-temperature sensor therefore cannot acquire an unrelated filter, drive-belt or coolant-change schedule.

Numeric schedules use verified Ford 2015 Mustang US/Canada owner guidance, limited to the 2.3L, 3.7L and 5.0L engines. They do not extend to 2016/2017, the 5.2L engine, Shelby/SVT articles, the 3160 transmission, or track use. With all engines selected, each item displays its supported engines and year explicitly. Selecting 5.2L removes these schedule items, even from otherwise shared articles. Selection also respects `documentApplicability`, including the 6R80 and MT82 application bounds.

The two stabilizer-bushing construction rules are separately supported by the current component procedures and suspension diagnosis. Their hashes must match before those details publish. They retain front versus rear orientation, no lubricant on the bar/bushing, rear installation water on the bracket only, new bracket bolts, and the front performance-package assembly restriction. These condition-based construction notes can appear for the 5.2L without introducing a borrowed numeric schedule.

Official sources were opened and checked on October 11, 2026:

- [2015 normal maintenance schedule](https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1649139&Uid=G1634876&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=usa&vFilteringEnabled=False&variantid=3259).
- [2015 special operating conditions](https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1649140&Uid=G1634877&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=usa&vFilteringEnabled=False&variantid=3259).
- [2015 owner checks and general maintenance](https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1614692&Uid=G1661539&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=usa&vFilteringEnabled=False&variantid=3259).
- [Electric power steering care](https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1448667&Uid=G1642990&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=usa&vFilteringEnabled=False&variantid=3259).

The online owner pages contain some generic multi-vehicle wording. Diesel water-separator, hybrid and other inapplicable items were not imported. Ford's online normal axle-fluid table and the axle exception have different wording: one lists 150,000 miles while the other conditions checks/changes on suspected leakage or submersion. The axle rule therefore supplies immediate condition-based care, flags the discrepancy, and does not silently choose a fixed replacement deadline.

## Coverage and limits

The full catalog audit covers all 2,264 public articles. At implementation, 244 match guidance and 2,020 intentionally return no item. Coverage includes suspension and bushings, wheels/tires, brake friction parts and parking brakes, steering, engine lubrication, engine/cabin filters, spark plugs, cooling, accessory belts, 6R80/MT82 fluid service, driveshafts/halfshafts, axle leaks, battery connections, washers/wipers, exhaust, lighting, latches and seatbelts.

There is no invented replacement mileage for bearings, tie rods, bushings, tensioners, batteries or brake pads. No blanket brake-fluid change interval, refrigerant recharge schedule, fuel-pump replacement, electronics cleaning routine or unverified Shelby schedule is supplied. Connector and wiring pages intentionally do not inherit maintenance through component-name text alone. Ordinary suspension inspections do not authorize greasing dry rubber bushings.

`catalog.report()` returns rule count, public article count, covered IDs/titles, rule mappings and validation errors. A local full-corpus report can be saved to `work/maintenance-audit.json` for inspection; it is not an API payload. The resolver reads only metadata, not article bodies or media.

Run `node --test tests/maintenance.test.mjs tests/maintenance-api.test.mjs`. Tests protect against wrong-engine/year schedules, shared-page Shelby leakage, wrong transmission type, timing-chain/safety-belt/sensor false matches, stale component evidence and private provenance exposure. The API integration test verifies detail/endpoint parity and invalid-year handling.
