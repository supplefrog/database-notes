# Database Notes

Systems & databases: a personal technical handbook with 56 chapters and eight task-linked database paths.

The published 0.1.0 baseline preserved the 81 reviewed Hermes files and added a relative root entry page. The 0.1.1 polish release repairs search/modal behavior, navigation marks and responsive spacing. It preserves 55 chapter articles byte-for-byte and corrects one obsolete Run/Reset instruction in the joins Practice paragraph and its two search-index copies. SQL, code, tables, figures, content destinations, fonts, assets and notices remain unchanged. The pond photograph and passage are unchanged; unintegrated replacement artworks and the unfinished Codex redesign are excluded. The reviewed homepage keeps text, controls and artwork clear across the checked responsive layouts.

## 0.1.2 navigation and action polish

Task-grouped chapters and nested sections now share one Contents tree: a rail on wide screens and one collapsible control on narrow screens. Chapter continuation comes before Sources, the database illustration clears its divider by 24px, and Back to top returns to the current page's top.

Search and diagram dialogs share brief entry/exit feedback, diagram fitting keeps controls stationary, and reduced motion settles immediately. Copy uses the selected dark icon-and-label treatment, with readable success/retry feedback and a control that stays in place while wide code scrolls. Input and focus remain immediate. All 56 chapter articles, their original anchors and code, tables, figures, citations and assets are preserved from 0.1.1.

The authorized in-app browser pass executed all 14 groups, including 78 layout states, 20 Contents states and Copy feedback/local-scrolling checks. Controlled copy-failure recovery was checked separately. Optional Linux runner execution, other browser engines, physical input/zoom, screen readers and displayed FPS remain unverified. No dependencies, CI workflows or hosting settings were added.

Recorded 0.1.1 observations are historical and do not certify this manifest; use the executable browser adapter for current measurements.

## 0.1.3 direct entry and navigation corrections

The selected A treatment opens reading content directly from Home: Operating systems, MySQL, PostgreSQL and MongoDB each have a chapter entry. The header database chooser and reader Contents offer the same paths; switching database product keeps the current shared task. Chapter breadcrumbs describe the subject without routing readers through a duplicate directory. Task comparison pages remain optional references.

Redundant arrows are removed from subject doors, Resume and database task-directory headings. Useful previous/next task arrows retain their sequence meaning. Back to top is a native button that changes scroll and focus without changing the URL or adding history; opening the database chooser is also history-neutral. The failure causes, misleading old assertions and durable regression contracts are recorded in [tests/README.md](tests/README.md#regressions-to-avoid).

All 19 executable browser groups passed, including 78 representative layout states, 20 Contents states and eight Home-to-reader entry states with real browser Back. Related-task product switches, keyboard/pointer disclosure behavior, repeated Back to top, search, diagrams and Copy were exercised. All 56 authored chapter articles, original anchors, code, citations, assets, search data and notices are preserved from 0.1.2. The static build, link/fragment checks and private-data scan passed. The optional Linux runner, other browser engines, physical input/zoom, screen readers and displayed FPS remain unverified. No dependencies, CI workflows or hosting settings were added.

## 0.1.4 history, Copy and Resume corrections

Same-document Contents, Search, citation/return and prose links now replace the current shareable fragment instead of adding Back stops. Actual page navigation, direct links and modified/new-tab links keep their normal behavior. Search closure no longer restores stale focus after a subsequent navigation.

Copy keeps its icon and text aligned through feedback. Fast writes go directly to the result; repeated clicks retain that result, with progress shown only for perceptible waits. Resume validates an early click before navigation and refreshes on restored Home/reading-state changes, retaining the saved database and section. With no valid saved location its fallback is labeled Start reading.

The 22-group browser suite includes repeated section/Search/citation navigation with actual Back/Forward, active Copy feedback observation and phone/wide Resume under delayed registry loading. All public HTML, authored articles, IDs, code, assets, search and registry data remain unchanged from 0.1.3. Browser observations and publication receipts remain outside the public output.

## Validate locally

Requires Node.js 24. No npm dependencies or installation are needed.

```sh
npm run build
python scripts/validate-web.py
```

The Node build validates all 82 public file hashes against `web-manifest.json`. The Python check also validates local links, fragments, search and reading-position destinations. The static source under `web/` is the complete deployment output; there is no framework compilation or server backend.

## Executable browser regressions

See [tests/README.md](tests/README.md) for the shared live-browser suite, the authorized in-app browser adapter, and the optional Linux runner prerequisites. This suite is not configured in CI; the recorded-evidence checker below remains separate.

## Recorded UI regression checks

The build and static validator do not launch a browser. UI corrections have a
separate checker for browser observations collected during local QA:

```sh
python scripts/check-ui-regressions.py "path/to/browser-evidence"
```

It checks modal controls/background scrolling, same-page search completion,
pointer/keyboard/restored focus, local vector marks, reader-control alignment,
responsive header and hero text/art/action/divider clearance, and the exact
static Practice guidance correction. Evidence is kept outside the public web
output. Its source stamp must match `web-manifest.json`; a source change requires
fresh affected browser observations, never just changing the stamp. The checker
does not rerun browser interactions, certify every layout, or run as part of CI.
Native zoom, trusted wheel/touch, physical-device, screen-reader and changed-cloud
coverage remain separately identified when not observed.

## Hosting

The published baseline is hosted at https://database-notes.vercel.app/ from `supplefrog/database-notes` and its Vercel `database-notes` project. No deployment identity, credentials, or deployment workflow are stored in this tree. The production branch publishes through the existing native Vercel Git integration.

Use repository root as Root Directory. `vercel.json` selects Other (`framework: null`), skips dependency installation, validates through Node, and serves only `web/`. A relative HTML entry page handles `/`; it has an ordinary link fallback and uses no Vercel-specific redirect.

Native Vercel Git deployment is the sole intended publisher. Its returned `vercel.app` address provides a non-GitHub public URL. No GitHub Pages deployment, automatic failover or second publisher is configured.

The files remain portable: all internal paths are relative, including the root entry. A future Pages migration can publish `web/` under a project prefix, after separately enabling Pages and verifying the new address. No such migration is enabled here.

After an authorized deployment, verify both the returned deployment URL and the assigned production URL:

```sh
node scripts/verify-live.mjs https://DEPLOYMENT-ORIGIN/
node scripts/verify-live.mjs https://PRODUCTION-ORIGIN/
```

The verifier also accepts a base path for an optional future static-host migration. It only reads the supplied URL; it never creates or changes a deployment.

## Content and notices

See [ATTRIBUTION.md](ATTRIBUTION.md), [LICENSE.txt](LICENSE.txt), and the bundled notices under `web/licenses/`. Source citations remain in the chapters.

Administration examples are documentation, not executed operational procedures. The earlier linked-blog site and repository are separate resources and are not deleted or redirected by this release. Bounded local browser QA and review evidence are retained outside this clean tree; this does not certify every page or device.
