# Contents text/material transition regressions

The previous seven glass cases exercised ownership and shape math. The browser
review also used settled targets. Neither observed font changes during glass
travel or while a narrow menu was fading out. Real pre-fix frame evidence shows
Kernel modules changing from40px to55.2px high and, during24 visible exit frames,
two native text-weight states against one frozen glass paint. Both violated the
existing continuity contract; no additional shared instruction is necessary.

The repair keeps semantic `aria-current`, history, focus and Resume immediate.
It blends paint-only emphasis according to the drawn pane's alignment. Native
and refracted text share the same stroke coverage and fixed line metrics.
Cached normal/emphasized optical sources avoid rerasterizing the full list on
every animation frame. Closed-menu native emphasis stays frozen with the pane.

`contents-glass-observer.mjs` exports a read-only rAF observer of the actual
reader. Start it immediately before genuine pointer/keyboard/wheel actions.
The loopback-only `python tests/contents-motion-server.py --port 8768` server injects it with `?qc=contents-motion`; it stores
bounded JSON in `#contents-motion-qc` for the IAB's read-only DOM API. No raw CDP,
synthetic scroll, public test UI or product test route is needed. The observer
does not change product state. Keep reports outside public web output.

`contents-glass-motion-checks.mjs` checks those measured intermediate frames:
no abrupt text weight jump, no rewrap during reading/selection, no bitmap reset
or independent text repaint during visible narrow exit, and no emphasis pop.
It permits stable bold text, smooth variable weight and reduced-motion jumps;
it does not prescribe one font implementation.

`contents-glass-browser-regressions.mjs` exports
`runContentsMotionRegressions({page,setViewport,wheel,clickContents,capture,baseURL})`.
This fresh runner navigates the actual reader, performs pointer/keyboard topic
selection, rapid reversal, native wheel forward/reverse and narrow exit/reopen.
It requires witnessed intermediate movement and visible exit frames. It checks
the reading destination and proper heading focus on selection; opening Contents
keeps native focus on its trigger. Eight fresh journeys passed on the current IAB.
The `capture(action)` adapter must start from an idle observer, read its current
sequence, execute the real action, wait for a new idle sequence and return only
the new batches. The private observer exposes data-running/data-sequence so this
uses ordinary DOM reads and native input without raw CDP. Saved reports are
receipts, not an input adapter for the fresh runner.

Run `npm run test:glass` for all fourteen pure cases. Optionally run
`node tests/contents-glass-emphasis.test.mjs <report.json>` against frame receipts.
The fresh runner uses `http://127.0.0.1:8768/design/handbook-lab/` as `baseURL`. Reuse the
actual reader at phone/wide widths: short-to-wrapped clicks, rapid reversal,
ordinary wheel in both directions, narrow selection/exit and reopen. Require
nonzero rendered travel/visible exit evidence. A final box or clicked hash
alone must not count. Rendered glyph edges and normal-speed movement still
need human inspection; frame metrics do not certify physical FPS or optics.
