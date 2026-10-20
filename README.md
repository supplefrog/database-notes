# Database Notes

A personal handbook for learning operating systems and administering MySQL,
PostgreSQL and MongoDB. Read by subject or follow a shared database task, with
Contents, local search, citations and a saved reading position.

[Read the handbook](https://database-notes.vercel.app/) · [Change history](CHANGELOG.md)

## Work locally

Requires Node.js 24 and Python 3. No npm dependencies or installation are needed.

```sh
npm run build
npm run check
npm run test:glass
python -m http.server 8765 --bind 127.0.0.1 --directory web
```

Open `http://127.0.0.1:8765/`. The static files in `web/` are the complete site;
there is no framework compilation or application backend. The build validates
the public inventory and hashes against `web-manifest.json`. The Python check
also checks local links, fragments, search and reading-position destinations.

The build checks that the package version has a current, unique changelog entry.
Run that check separately with `npm run check:release`. Keep release history in
[CHANGELOG.md](CHANGELOG.md), with supporting commits and verification limits.

## Browser verification

[tests/README.md](tests/README.md) owns the executable browser journeys,
authorized in-app browser adapters, recorded-evidence validation and coverage
limits. Use fresh affected journeys for UI changes; saved observations do not
rerun a browser. Browser checks are not configured in CI.

## Publishing

The existing native Vercel Git integration publishes the production branch of
`supplefrog/database-notes`. It is the sole publisher. `vercel.json` uses the
repository root, selects Other, skips dependency installation, runs the static
validation build and serves only `web/`. The relative root entry has an ordinary
link fallback, and internal paths remain portable.

After an authorized deployment, verify its URL and the assigned production URL:

```sh
node scripts/verify-live.mjs https://DEPLOYMENT-ORIGIN/
node scripts/verify-live.mjs https://database-notes.vercel.app/
```

The verifier reads and compares deployed files; it does not deploy. No GitHub
Pages publisher, automatic failover or alternate hosting path is configured.

## Content and notices

Administration examples are documentation, not executed operational procedures.
Source citations remain in the chapters. See [ATTRIBUTION.md](ATTRIBUTION.md),
[LICENSE.txt](LICENSE.txt) and the bundled notices in `web/licenses/`.
