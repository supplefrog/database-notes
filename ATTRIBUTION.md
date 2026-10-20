# Sources, licenses and provenance

## Notes and reader

The Operating Systems/MySQL notes and retained homepage wording derive from [supplefrog/linked-blog-md](https://github.com/supplefrog/linked-blog-md), revision `fad886120d7cfdbd91ab2e1315c745fe1e564cee`. The source repository's GPL-3.0 license is preserved unchanged in `LICENSE.txt` and `web/licenses/notes-GPL-3.0.txt`. The current project split and reviewed those notes, authored PostgreSQL/MongoDB material and teaching figures, and produced the static handbook presentation. Chapter-level citations and product-specific notices remain with the content. Original source history and template samples are not imported into this clean tree.

## Fonts

- Newsreader: Copyright 2020 The Newsreader Project Authors. SIL Open Font License 1.1; full notice at `web/licenses/newsreader.txt`.
- IBM Plex Mono: Copyright 2017 IBM Corp. All rights reserved. SIL Open Font License 1.1; full notice at `web/licenses/ibm-plex-mono.txt`.

The bundled font files and their complete notices are unchanged.

## Homepage photograph and passage

The 720 × 536 pond photograph in `web/design/review-preview/assets/horse-full.png` is the user-supplied image, retained unchanged. It has no embedded creator/license metadata, and no originating photographer or publication-license page has been established. This records a provenance limit, not a finding that permission is absent. The unrelated Flickr horse photograph used in an earlier research-method demonstration is not this image and supplies no attribution or license for it.

The Sanskrit/English passage is retained from the original homepage, where both forms were introduced by `supplefrog` in commit `94886eef71f135f32e260e362a45df0ec4b8f8d4` on 2025-04-16. That establishes the project source, not authorship or a scriptural locator. A historical description associated it with the Garuda Purana; no matching chapter, verse, edition or translator has been verified. The displayed page makes no scriptural attribution, and this project adds none.

The existing expressive WebP artworks are project-generated assets carried forward from the approved site. Newly generated replacement artwork candidates are not included.

## DB Lab browser SQLite

The DB Lab bundles [sql.js](https://github.com/sql-js/sql.js) version 1.15.1 from
the npm registry. The package SHA-512 was verified before extracting its loader,
WebAssembly binary and complete [MIT notice](web/lab/vendor/sql.js/LICENSE).
SQLite itself is public domain. No package-manager install or runtime CDN is
required. The Lab fixture, application replay, independent expected-state oracle
and interface are project-authored; the historical recording remains intact.
