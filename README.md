# Database Notes

Systems & databases: a personal technical handbook with 56 chapters and eight task-linked database paths.

The published 0.1.0 baseline preserved the 81 reviewed Hermes files and added a relative root entry page. The 0.1.1 polish release repairs search/modal behavior, navigation marks and responsive spacing. It preserves 55 chapter articles byte-for-byte and corrects one obsolete Run/Reset instruction in the joins Practice paragraph and its two search-index copies. SQL, code, tables, figures, content destinations, fonts, assets and notices remain unchanged. The pond photograph and passage are unchanged; unintegrated replacement artworks and the unfinished Codex redesign are excluded. The reviewed homepage keeps text, controls and artwork clear across the checked responsive layouts.

## Validate locally

Requires Node.js 24. No npm dependencies or installation are needed.

```sh
npm run build
python scripts/validate-web.py
```

The Node build validates all 82 public file hashes against `web-manifest.json`. The Python check also validates local links, fragments, search and reading-position destinations. The static source under `web/` is the complete deployment output; there is no framework compilation or server backend.

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
