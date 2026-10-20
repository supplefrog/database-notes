# Changelog

Changes are grouped by package milestone, with supporting commits and comparisons.
Original dates are retained; entries without a recorded release date omit it. These links do not imply version tags or GitHub Releases.
Browser verification scope and historical QA records live in
[tests/README.md](tests/README.md).

## [Unreleased]

### Changed

- Keep the README focused on current use, verification and publishing; consolidate
  package history here and move detailed QA narratives to the test documentation.
- Check package/changelog consistency in the normal build, with a standalone
  release check and regression cases for stale or duplicated entries.

## [0.1.13]

### Changed

- Give Contents and search results a rounded native scrollbar pill whose track
  fades in on interaction. Fade the horizontal code pill in without a track;
  preserve the default green accent, native dragging and stable scrollbar lanes.
- Let Back to top form at the absolute bottom of short scrollable pages, keeping
  the existing travel threshold for long pages and hiding it on pages that fit.
- Keep keyboard, reduced-motion and unsupported-feature fallbacks, and preserve
  the separately published DB Lab startup retry fix unchanged.

### Verification

- Source-stamped in-app observations cover the short-page boundary, history-neutral
  return, native scrollbar interaction, narrow navigation and stable geometry.
  The previous release fails the new bottom-trigger check. Scope and remaining
  browser/media limitations are recorded in tests/README.md.

## [0.1.12] - 2026-10-21

### Changed

- Keep narrow Contents painted and anchored through its complete exit; pointer
  and keyboard reopening reverse from its current visual state.
- Enhance chapter links with same-document reader replacement, native history,
  actual Back/Forward positions, focus and a real document-link fallback.
- Show Back to top after further reading travel, with live backdrop refraction
  and a reversible spring entrance; retain one history-neutral native button.
- Dispose prior reader listeners, observers and optical resources on chapter
  replacement. Preserve the existing Contents optics and authored content.
- Preserve the separately published 0.1.11 DB Lab exercise, assets, validation
  rules and documentation; no Lab runtime bytes change in this release.

### Verification and compatibility

- Eighteen scoped in-app browser journeys and separate pointer/keyboard, bubble
  and chapter reversals passed. Both narrow heading exits had zero measured
  panel drift. Nineteen existing pure motion/ownership cases passed.
- Browsers without navigation interception retain ordinary document links.
  Refraction depends on SVG backdrop-filter support; reduced motion uses static
  feedback. No content migrations or reader setup changes are required.
- External Chrome's reported freeze, physical display cadence, slow-network
  failure and runtime media-preference switching remain unverified. The scoped
  passes do not establish a new full 25-group suite pass.

## [0.1.11]

- Add the reviewed browser SQLite recovery exercise to the existing DB Lab
  workbench: seed, bounded tenant fault, checkpoint restore, application-journal
  replay, actual query results and independent count/content verification.
- Preserve historical benchmark timings and recorded recovery evidence. Forward
  the old recovery route into the current workbench, and keep recorded metadata
  correct through recovery/benchmark navigation.
- Vendor checksum-verified MIT sql.js 1.15.1 for static hosting. Data stays local
  and synthetic; application replay is explicitly distinct from native engine PITR.
- The reviewed IAB journeys cover recovery outcomes, navigation, history and
  mobile reset. Reduced-motion, forced-colors, zoom and injected load-failure
  checks remain unverified. Notes UI and authored chapter content are unchanged.

## [0.1.10]

- Reserve Contents scrollbar space so opening or closing a group does not shift
  its labels horizontally.
- Remove the inner chapter rectangle and add a restrained spring entrance for
  the optical glass surface, retaining fixed native text geometry and reversible
  disclosure behavior.
- Add native-input regression journeys for overflow thresholds, intermediate
  bubble formation and interruption, alongside pure entrance tests.

## [0.1.9]

- Blend text emphasis with the glass's drawn position instead of changing line
  weight before the pane arrives. Keep native and refracted line breaks aligned.
- Prepare matching paint before narrow entry, and freeze native ink with the
  retained pane during visible exit.
- Add intermediate-frame observers and fresh browser journeys for travel,
  ordinary scrolling, reversal and narrow closing/reopening.

## [0.1.8]

- Integrate liquid glass into the existing Contents links while keeping the
  application responsible for navigation, current section, history and Resume.
- Add the hidden DB Lab entry, then constrain it to a small accessible hotspot
  on the homepage globe; the rest of the artwork remains inactive.
- Expand the replication chapters with disk-bound lag diagnosis and durability
  tradeoffs for MySQL, PostgreSQL and MongoDB. These are documentation changes,
  not executed administration procedures.

## [0.1.7]

- Publish the reviewed standalone glass experiment in [244b1dc](https://github.com/supplefrog/database-notes/commit/244b1dc).
- Add the reviewed DB Lab and its read-only recorded recovery in
  [5820f7e](https://github.com/supplefrog/database-notes/commit/5820f7e).
- Remove the standalone glass preview in [edcd726](https://github.com/supplefrog/database-notes/commit/edcd726),
  preserving Notes and DB Lab. The removed preview URLs no longer provide that
  experiment; later glass work is integrated into the reader.

## [0.1.6]

- Allow real wheel, pointer, touch and navigation-key input to interrupt animated
  page travel without a stale destination resuming or stealing focus.
- Add native-input takeover and rapid-navigation regression coverage.

## [0.1.5]

- Track the section actually being read through selection and ordinary scrolling,
  and save that validated location for Resume without adding history stops.
- Remove exiting database-chooser options from keyboard interaction immediately,
  while retaining their exit paint.

## [0.1.4]

- Replace same-document fragments for Contents, Search, citations and prose links
  without adding Back stops; preserve normal page and modified-link navigation.
- Prevent stale search-close focus restoration after later navigation.
- Keep Copy feedback aligned, omit imperceptible progress flashes and preserve
  repeat-write feedback.
- Validate early Resume activation, refresh restored Home links and label the
  starting fallback truthfully.

## [0.1.3]

- Open reading content directly from Home and the subject chooser; keep database
  product switches within the current shared task and comparisons optional.
- Omit redundant entry arrows while retaining useful progression/disclosure cues.
- Make Back to top a native history-neutral viewport action, and keep database
  chooser disclosure history-neutral.

## [0.1.2]

- Use one task-grouped Contents tree as a wide reading rail and narrow control,
  with nested sections and continuation placed before Sources.
- Refine reader spacing and illustration clearance; coordinate dialog entry/exit
  and keep diagram controls stationary during fitting.
- Apply the selected icon-and-label Copy treatment with readable feedback and
  stationary placement while code scrolls locally.
- Preserve authored chapter content, anchors, citations, code and assets while
  adding executable browser regression journeys.

## [0.1.1] - 2026-10-19

- Keep the reading page still while search or the diagram viewer is open; scroll only modal results/canvas so query and close controls remain available.
- Complete same-page search navigation by closing the modal and focusing the exact heading while retaining native links and history.
- Keep pointer-only search focus quiet while preserving keyboard, restored-focus and forced-color feedback.
- Replace navigation arrow font glyphs with vector marks and align narrow reader controls when a label wraps.
- Keep a consistent gap between wrapped header rows, fill an isolated search row, and prevent subject-name wrapping near tablet widths. Clear the phone hero artwork from Resume and the following divider.
- Keep desktop hero text clear of the illustration; check both text boxes and actual line fragments. Add a source-bound checker for recorded UI regression evidence, explicitly separate from automatic browser/CI testing.
- Correct obsolete Run/Reset guidance in one joins Practice paragraph and its two search-index copies; SQL, code, result data and figures are unchanged.
- Preserve 55 chapter articles byte-for-byte, all content destinations, pond/passage, font assets and notices. Preserve the reviewed design and publish through the existing Vercel Git integration.

## [0.1.0] - 2026-10-19

- Preserve the reviewed 56-chapter Hermes handbook and eight database task paths without redesign.
- Add a relative root entry page while keeping all 81 original public files unchanged.
- Configure a single native Vercel Git publishing path with portable static output and dependency-free hash validation.
- Retain note/font notices and record precise homepage provenance limits without changing the pond or passage.

[Unreleased]: https://github.com/supplefrog/database-notes/compare/02a7c42fdc66cc9fe1b1e4a720aa317359cfecab...main
[0.1.10]: https://github.com/supplefrog/database-notes/compare/011d0f7b680f35ad71655eac2055b86a5bbc17cf...02a7c42fdc66cc9fe1b1e4a720aa317359cfecab
[0.1.9]: https://github.com/supplefrog/database-notes/compare/263c9fb5d00990a545260d9e3710639556aefa43...011d0f7b680f35ad71655eac2055b86a5bbc17cf
[0.1.8]: https://github.com/supplefrog/database-notes/compare/edcd726e24f450cfc51f3b39eb4cb3c3c05c7e8c...263c9fb5d00990a545260d9e3710639556aefa43
[0.1.7]: https://github.com/supplefrog/database-notes/compare/bb59d1f773352f30a34496ec086182225c71a410...edcd726e24f450cfc51f3b39eb4cb3c3c05c7e8c
[0.1.6]: https://github.com/supplefrog/database-notes/compare/3bf7c610b11fca7aef04f29f4e6543d8b07a8075...bb59d1f773352f30a34496ec086182225c71a410
[0.1.5]: https://github.com/supplefrog/database-notes/compare/6e87991ef37b19b561b8172dbd83d5b755f0c6ea...3bf7c610b11fca7aef04f29f4e6543d8b07a8075
[0.1.4]: https://github.com/supplefrog/database-notes/compare/b998250cd857196875fe7e742f99d00806775554...6e87991ef37b19b561b8172dbd83d5b755f0c6ea
[0.1.3]: https://github.com/supplefrog/database-notes/compare/b21b6e28998d723188953bd0f5c49aac78c5b108...b998250cd857196875fe7e742f99d00806775554
[0.1.2]: https://github.com/supplefrog/database-notes/compare/970488750bb3ea6575a24f0a4c234f4a751ddf34...b21b6e28998d723188953bd0f5c49aac78c5b108
[0.1.1]: https://github.com/supplefrog/database-notes/compare/27843d557ddea495c0b8a770aef70c8cb2891da2...970488750bb3ea6575a24f0a4c234f4a751ddf34
[0.1.0]: https://github.com/supplefrog/database-notes/commit/27843d557ddea495c0b8a770aef70c8cb2891da2
