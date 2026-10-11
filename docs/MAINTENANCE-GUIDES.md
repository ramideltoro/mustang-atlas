# Maintenance library and normal schedule

`content/maintenance-guides.json` contains 46 original guides in eight categories and an eight-group schedule. The library explains what a service accomplishes, why it matters, when to perform it, how to prepare, the broad work sequence, signs that need attention, and the purpose of each linked repair article. It complements the component-specific care items in `content/maintenance.json`; all 29 existing care rules map uniquely to a detailed guide.

## Coverage

The categories cover service planning, engine/cooling, tires/brakes/handling, transmission/rear axle, electrical systems, cabin/visibility, body hardware, and advanced maintenance. The schedule includes every task in Ford's 2015 normal-maintenance table, with separate groups for oil-change service, 20,000 miles, 30,000 miles, 100,000 miles, 150,000 miles, recurring coolant replacement, monthly checks, and six-month checks.

The oil-life bands are estimates of when a message may appear. Their original distances and usage distinctions are retained: normal 7,000–10,000 miles, severe 5,000–7,000, and extreme 3,000–5,000. Normal use excludes extended idling; severe use explicitly includes engine braking and hard cornering. The displayed kilometer ranges follow Ford's published values rather than freshly calculated conversions.

The schedule preserves the one-year/10,000-mile maximum, resetting the oil-life monitor after an actual oil/filter change, and the 3,000-mile coordination window for other work without extending its designated deadline. It retains the initial coolant limit of six years/100,000 miles and subsequent three-year/50,000-mile interval, plus the belt inspection at 100,000 miles and every other oil change until replacement.

Monthly and six-month checks cover the applicable gasoline-car owner tasks, including existing tailpipe openings, body drains, weatherstrips, latches, lighting, seatbelts, warning lamps and visibility. The recommended multi-point inspection includes belts, battery performance, air filter, hoses, windshield condition and temporary-mobility-kit sealant expiry where fitted. Generic diesel fuel/water-separator instructions are excluded.

## Applicability and editorial limits

These guides and numeric intervals apply to the 2015 2.3L, 3.7L and 5.0L road-car applications. They do not supply a 5.2L/Shelby, later-model-year or track-use schedule. A shared article does not make a base-engine interval suitable for every variant. The backend filters guide results, linked procedures and thumbnails by the selected engine and suppresses the normal schedule for unsupported selections.

Ford's online normal schedule lists a 150,000-mile rear-axle fluid change. Its special-conditions page separately says checks or changes are not required unless a leak is suspected or the axle has been submerged. Both statements remain visible in the schedule and axle-fluid guide; readers are directed to confirm the instruction applicable to their vehicle. Neither statement is silently discarded or promoted into a universal deadline.

The 6R80 level-check guide distinguishes its transmission-mounted indicator and specified fluid-temperature check from an ordinary owner dipstick check. The schedule retains the original conditional dipstick wording. The MT82 guide does not apply to the 3160 transmission.

A guide's overview sequence does not replace the complete linked repair procedure. No new torque values, fluid quantities, bleeding sequence, lifting points or repair specifications are invented. Bearings, bushings, brake pads, batteries and similar parts receive condition-based decisions rather than fabricated replacement mileage. Stabilizer-bushing care preserves the dry-rubber construction precautions and performance-package service restrictions.

The local catalog's explicit engine-oil draining/filling article is for the 5.2L. It is not linked as a base-engine oil-change walkthrough. The base-engine oil guide instead explains planning, specification selection, verification and the verified owner-display reset; its linked component views and filter-debris inspection are labeled for their actual purpose. A separate oil-level guide gives the verified owner dipstick and topping-up sequence.

## Advanced maintenance

The 14 Advanced maintenance guides extend routine care with condition-based diagnostics, targeted service, and repair follow-up. It is linked prominently from the maintenance hub, has its own searchable category, and identifies the equipment, preparation, reasons, sequence, observations and matching workshop procedures for each job. Category descriptions also appear above filtered results. The new guides provide 67 procedure links to 57 distinct service articles.

These guides do not add periodic jobs to the normal schedule. Brake and clutch bleeding follow hydraulic work or an air-related diagnosis; A/C testing follows poor performance or suspected leakage; cooler backflushing is tied to the specified transmission repair; charge-air cooler cleaning requires a justified condition. Alignment and corrosion-protection articles explain the inspection or repair trigger. Numerical diagnostic setup values are retained only where they are supported by the linked procedure; they are not promoted into service intervals.

The guides cover the existing 2015 base-engine scope. MT82-only and 6R80-only tasks declare their equipment limits, while EcoBoost charge-air cooler guidance is available only for the 2.3L. Linked procedures and hero images continue to follow the global engine filter. Original care-rule mapping stays unique; relevant basic guides link onward to advanced guides through their related reading.

The brake-pulsation guide does not invent a standalone hub-flange runout tolerance. The local brake specification table contains an inconsistent six-piston bleeder torque unit pair, so the overview does not repeat that unresolved value. Generic coating illustrations are described as application examples, and the selected corrosion hero depicts underbody seam locations. Owner-check evidence provides inspection context; the private, hash-bound workshop references support the advanced procedure details.

## Seed and provenance

The version-1 seed contains `categories`, `guides`, `schedule` and a private `evidence` map. Every guide records:

- Stable ID, category, applicable engines/year, and related care rule IDs.
- Original introduction, explanation, timing, preparation, steps, observations and notes.
- Related article IDs with a specific purpose, related guide IDs, and an exact article/media ID for its hero.
- Private `sourceRefs` binding every linked/hero article to its current source hash, plus official evidence keys.

All 46 authored hero selections were visually inspected. They are existing component illustrations or functional diagrams, not fabricated maintenance photographs. The backend can choose a compatible substantive illustration from a related article when an engine filter changes. Guide prose therefore does not promise that a fixed engine's picture is always displayed.

The main primary references were checked on October 11, 2026:

- [Ford normal maintenance schedule, 2015 Mustang](https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1649139&Uid=G1634876&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=usa&vFilteringEnabled=False&variantid=3259).
- [Ford special operating conditions](https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1649140&Uid=G1634877&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=usa&vFilteringEnabled=False&variantid=3259).
- [Ford owner checks and multi-point inspection](https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1614692&Uid=G1661539&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=usa&vFilteringEnabled=False&variantid=3259).
- [Ford engine oil check](https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1612345&Uid=G1634792&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=usa&vFilteringEnabled=False&variantid=3259).
- [Ford information-display controls](https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1642764&Uid=G1634745&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=usa&vFilteringEnabled=False&variantid=3259).

Additional evidence keys identify electric steering, warning messages and brake-fluid checks. Evidence URLs, source hashes and source references are not exposed as public article provenance. The normal-schedule link resolves internally to `#/maintenance/schedule`; linked repair articles use `#/document/<id>`.

## API and verification

`createMaintenanceGuideCatalog(db, {contentDir, assetResolver})` in `server/maintenance-guides.mjs` provides library listing, guide detail, schedule, care-rule lookup and a validation report. The server exposes `/api/v1/maintenance`, `/api/v1/maintenance/schedule` and `/api/v1/maintenance/:id`. The authored text is preserved through these projections. A stale bound source hash suppresses the affected guide and incomplete schedule rather than publishing unchecked content.

Run:

```sh
node scripts/audit-maintenance-guides.mjs
node --test tests/maintenance-guides.test.mjs tests/maintenance-api.test.mjs
```

The final seed audit passed with 46 guides, eight categories, all 29 care-rule mappings, 174 related-article links, 165 checked thumbnail occurrences, 268 article-care guide links and 182 engine-filter checks, with zero issues. The report is saved privately to `work/maintenance-guides-audit.json`. Counts of thumbnail occurrences include related-article images and are not a count of unique authored heroes.

The advanced release passed 170 automated tests and a production client build. All 14 new heroes loaded; all linked procedure destinations and engine-specific projections passed the release checks. A full public-catalog audit passed across 2,264 articles, 9,372 resolved references and 45,590 variant checks. Four visually verified navigation/expand-control asset identities are now excluded from thumbnail selection; their underlying article content remains intact.
