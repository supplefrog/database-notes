# Scrollbar thresholds and bubble entrance

Run `npm run test:glass` for all 19 pure ownership, emphasis and entrance cases.
The five entrance cases check intermediate growth, restrained overshoot, retained
state on reversal, callback-gap bounds, unchanged text geometry and reduced motion.
Pure tests do not establish rendered continuity.

For fresh browser regression, start the loopback-only actual-reader server:

```sh
python tests/contents-motion-server.py --port 8768
```

Use the existing authorized Codex IAB. Do not launch an external browser. The
server adds the read-only observer only to HTML with `?qc=disclosure` and exposes
its module at `/__qc/disclosure-observer.mjs`. Ordinary pages remain identical to
public output. No observer, reports or test routes belong in `web/`.

Import `tests/disclosure-browser.mjs` through the documented CUA Node runtime and
call `runDisclosureRegressions({page,setViewport,capture,clickContents,burstGroup,
burstContents,baseURL})`, with the reader base
`http://127.0.0.1:8768/design/handbook-lab/`.

The `page` adapter needs ordinary `goto` and `locator`, and `setViewport` uses the
IAB viewport capability. Reuse the same displayed IAB QA tab. Native trigger
click adapters obtain fresh screenshot/DOM coordinates before clicking. The burst
adapters perform three real clicks with short holds on the group or Contents
trigger; the verified IAB used `{clickCount:3,durationMs:10}`. This exposes an
open/close/reopen during actual expansion. A settled replay or synthetic `.click()`
does not establish this witness. Reset the temporary viewport after verification.

The capture adapter reads fresh frames through ordinary read-only DOM APIs:

```js
const capture = async action => {
  const idle = '#contents-disclosure-qc[data-running="false"]';
  await tab.playwright.locator(idle).waitFor({state:'attached',timeoutMs:5000});
  const before = Number(await tab.playwright.locator('#contents-disclosure-qc')
    .getAttribute('data-sequence'));
  await action();
  await tab.playwright.locator(idle+':not([data-sequence="'+before+'"])')
    .waitFor({state:'attached',timeoutMs:5000});
  return JSON.parse(await tab.playwright.locator('#contents-disclosure-qc')
    .textContent()).filter(batch => batch.sequence > before);
};
```

The observer records pre-default geometry plus actual intermediate frames, native
scrollport dimensions, disclosure opacity/size, fixed native text bounds and the
last-drawn optical body. It never drives product input. Reports are receipts,
never an input adapter for the fresh runner. No raw CDP is needed.

Twelve fresh journeys cover wide overflow appearing/disappearing, group opening
with material formation, rapid keyboard reversal, narrow menu and group entry,
closing, reopening and interrupted still-forming glass. Checks require actual
overflow threshold changes and witnessed partial expansion/reversal; absent
evidence cannot count as a pass. The existing eight glass reading-motion journeys
also remain relevant to navigation, plain wheel, text/paint and heading focus.

The old real IAB recordings changed the wide rail client width from 235px to
250px when a group closed, then back on opening. The old pane was already fully
sized at the first visible opacity frame. These same geometry and entrance
checks reject that baseline for width/label movement and missing expanding
frames. The repair reserves gutter occupancy, removes the unnecessary inner
chapter rectangle, and expands the actual optical surface around fixed native
ink. It does not scale or duplicate foreground text.

The existing frontend contract already required relevant scrollbar occupancy,
complete open/close and interruption. The earlier tests did not cross this
overflow threshold or observe material formation. This documents an enforcement
gap; no shared skill instruction was added.

Scope limits: sampled DOM/rAF and last-drawn material state do not certify
physical FPS, physical touch, native zoom/fractional DPR or optical pixel
equivalence. Inspect normal-speed rendering and deliver an interactive preview.
The scoped acceptance run did not execute the complete 25-group suite or CI;
reduced-motion spring behavior was pure-tested, without a runtime preference
switch. Preserve native/high-contrast fallback and all navigation neighbors.
