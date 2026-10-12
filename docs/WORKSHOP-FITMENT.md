# Workshop configuration evidence

These are private authoring notes, not public article content. Application rules describe factory configurations supported by the 2015 catalog; accessory conversions do not establish original equipment fitment.

## Front brakes

Ford's 2015 Mustang press kit identifies these front-brake applications:

| Procedure family | Applicable engines | Equipment distinction |
| --- | --- | --- |
| Two-piston front caliper | 2.3L, 3.7L | Base EcoBoost or V6 brakes |
| Four-piston front caliper | 2.3L, 5.0L | EcoBoost Performance Package or standard GT brakes |
| Six-piston front caliper | 5.0L | GT Performance Package brakes |
| SVT Performance Package | 5.2L | Separate GT350 hardware and procedures |

Evidence checked October 12, 2026:

- [2015 Ford Mustang press kit](https://media.ford.com/content/dam/fordmedia/North%20America/US/2014/08/21/mustang/15mustang-kit.pdf), published September 12, 2014. The primary PDF's indexed text retains the package mapping; opening this legacy URL currently redirects to Ford's newer media site.
- [Ford's European introduction](https://media.ford.com/content/fordmedia/feu/gb/en/news/2014/07/17/ford-announces-power-outputs-for-all-new-mustang--lightweight-bo.html), July 17, 2014, confirms four-piston EcoBoost and six-piston GT front brakes for European factory packages.
- [GT350 supplement, July 2015](https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/2015-2016-Mustang-Shelby-GT350-Supplement-version-1_su_EN-US_07_2015.pdf), printed page 6 / PDF page 8, identifies the separate GT350 front and rear calipers and its 3160 gearbox.

Apply piston-count rules only to front-disc procedures in section 206-03. Rear four-piston GT350 brakes are a different application. The local catalog has separate SVT caliper/pad procedures (`G1716188`, `G1716191`) alongside the base-car six-piston procedures (`G1693780`, `G1693791`); do not merge their tightening or replacement instructions.

Generic brake chapters, shared tests and body-text mentions do not establish one package's applicability. The exact reviewed parking-brake diagnosis `G1693765` is an exception: its decision tree isolates cables at rear-caliper actuators and can direct rear-caliper replacement. Like the reviewed base adjustment and cable procedures, that chapter is hash-bound to the base engines and cannot diagnose the GT350's separate parking shoes. Narrow a generic replacement procedure only after checking its actual component scope and its separate SVT counterpart. An engine choice cannot distinguish every optional brake package, so retain the fitted-equipment label and confirmation step.

## Transmission and clutch

The 5.2L's 3160 transmission is distinct from MT82 and 6R80 work. Some shared clutch chapters inherited an MT82 heading even when an explicitly named 5.2L procedure is present. Preserve an explicit engine-specific procedure and its actual linked gearbox path; do not infer all shared clutch parts are interchangeable.

Examples checked against the local procedure evidence:

- `G1791227` is explicitly the 5.2L clutch procedure and links to 3160 work.
- `G1687288` treats the 5.2L pilot bearing as nonserviceable, with flywheel replacement; a separate bearing replacement guide covers the base engines.
- `G1701833` supplies base-engine MT82 access links, so its slave-cylinder replacement scope is not extended to the 5.2L.
- Automatic transmission cooling and external controls belong to the 6R80 base-engine applications. Paddle-shift articles must not become GT350 procedures merely because their imported engine field is empty.

## Convertible body applications

The factory GT350 and GT350R are fastbacks. The [2015 Ford GT350/GT350R technical specifications](https://media.ford.com/content/dam/fordmedia/North%20America/US/2015/08/24/gt350-gt350r-tech-specs.pdf) identify `Fastback` in the body-style table. The original Ford PDF text remains in the search index; its legacy direct URL currently redirects to Ford's newer media site. This is not a claim that the PDF was freshly downloaded from that redirect.

`server/body-applicability.mjs` limits unequivocally convertible-only articles to the 2.3L, 3.7L and 5.0L factory applications. It recognizes the complete word `convertible` in an article title, or the exact `Convertible Top` section. This includes clearly named roof components, convertible-only trim and belts, connector views and the dedicated roof wiring sheets. Explicit compatible engine metadata remains narrower.

Titles covering both coupe/fastback and convertible stay shared. Body prose, related article titles and isolated drawing labels are not used: a general chapter can contain a convertible branch or access cross-reference without being convertible-only. `Torque Converter` and `Catalytic Converter` are unrelated words and cannot trigger this rule. The rule describes factory fitment; it does not infer an aftermarket conversion.

The October 12 review found 52 source documents matching this narrow boundary and 31 then-published workshop guides with exclusively convertible primaries needing their engine metadata narrowed. Generated guides retain their reviewed prose; the publisher projects the corrected primary-document scope and the API rejects stale incompatible primary bindings. The reviewed inventory is recorded privately in `work/convertible-applicability-audit.json`.

Two additional generic-title procedures, rear-quarter speakers `G1694055` (SYNC) and `G1693903` (SYNC 2/SYNC 3), are individually bound to their reviewed hashes. Each complete procedure requires convertible loadspace trim removal with no coupe branch. This adds those two articles without broadening the rule to incidental convertible references elsewhere. A generated-title scan found the shared speaker guide as the only remaining then-published convertible-only title claiming 5.2L.
