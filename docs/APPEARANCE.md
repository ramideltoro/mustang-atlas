# Navigation, themes and article covers

Updated October 25, 2026.

## Search and navigation

Search lives in the header and opens a keyboard-accessible dialog (`Cmd/Ctrl+K`). It searches the library, care/workshop guides, or glossary; the current page selects the initial scope. An all-library search also shows matching workshop guides. The user's engine selection remains active. The footer shortcut opens the same dialog.

The home, library, workshop hub and glossary no longer render duplicate search bars. Library system/subsection navigation stays in the sidebar and its mobile drawer. The duplicate “Explore [system]” subsection panel has been removed. Article outlines and technical tables are retained.

## Theme preferences

The palette selector in the header offers the six themes used on NutsNews: Amber, Sakura, SaaS, Foxy, Butterfly and Bambi. Sakura and Foxy use light surfaces; the others use dark surfaces. Theme names, palette families and swatch selection follow NutsNews; Atlas controls and technical reading layouts remain its own.

`src/theme-model.mjs` defines the options and validates the preference. `public/theme-init.js` restores it before paint without an inline script or relaxing CSP. The key is `mustang-atlas:theme:v1`. Unknown values fall back to Amber; storage failures still allow changing the theme for the current visit. Changes synchronize between tabs. No account, cookie or network service is needed.

The shared semantic tokens in `src/themes.css` cover navigation, cards, reader text, callouts, tables, forms, glossary dialogs and the workshop pages. Source illustrations keep their original pixels and a light canvas. Semantic diagnostic and warning colors remain distinct from decorative accents. Print styles remain paper-friendly.

## Thumbnail coverage

An article uses a substantive image from its own content when one is available. Existing media selection and exclusions still prevent controls, tiny icons and unrelated supporting procedures becoming technical heroes.

`shared/article-thumbnail.mjs` selects an original conceptual cover by title, section and vehicle system when an article has no suitable image. The 29 independently drawn SVG covers are reproducibly generated with:

```sh
node scripts/generate-article-thumbnails.mjs
```

These are editorial topic illustrations, not vehicle-specific assembly drawings or instructions. They contain no source-manual images, remote media or generated factual specifications. Creating them requires no model API or separate API charges.

Workshop guide responses add `cardThumbnail`. This is always available for a matching configuration and can use original editorial art. The existing `thumbnail` field continues to represent the technical hero and may remain null for explicit-only guides, so a conceptual cover is never mistaken for a verified repair illustration. The reader uses original cover art when there is no technical hero. `ArticleThumbnail` also falls back gracefully if an existing source-image request fails.

Validate coverage with the application running:

```sh
node scripts/audit-article-thumbnails.mjs http://127.0.0.1:3186
```

The audit paginates the full public article and guide catalogs and checks every distinct cover URL's HTTP status and image content type. Initial release: 2,264 articles, 948 guides, 1,877 unique thumbnail URLs; 372 article and 286 guide gaps filled with original illustrations. No technical procedure or source illustration was replaced.
