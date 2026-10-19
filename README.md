# Database Notes

Systems & databases: a personal technical handbook with 56 chapters and eight task-linked database paths.

The 81 reviewed Hermes pages, assets, fonts and runtime files are preserved byte-for-byte. A new relative root entry page opens the existing handbook. The pond photograph and passage are unchanged; unintegrated replacement artworks and the unfinished Codex redesign are excluded.

## Validate locally

Requires Node.js 24. No npm dependencies or installation are needed.

```sh
npm run build
python scripts/validate-web.py
```

The Node build validates all 82 public file hashes against `web-manifest.json`. The Python check also validates local links, fragments, search and reading-position destinations. The static source under `web/` is the complete deployment output; there is no framework compilation or server backend.

## Hosting

Prepared for a fresh `supplefrog/database-notes` repository connected to a fresh Vercel `database-notes` project. Public repository creation is approved. Vercel project linking and publication are handled separately; no deployment identity, credentials, or deployment workflow are stored in this tree.

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

Administration examples are documentation, not executed operational procedures. The existing live site and its repository are separate resources; this candidate does not delete, replace or redirect them. Historical reader QA is retained outside this clean tree; a fresh browser pass is not claimed.
