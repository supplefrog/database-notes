# Executable browser regressions

`ui-regressions.mjs` performs fresh browser navigation, keyboard/pointer actions
and DOM measurements through an injected adapter. It does not read saved QA
observations. Run it for changes that can affect the UI; documentation-only
changes do not need the full browser pass. Static build/link checks are separate.

The current candidate has 14 executable groups: 78 representative layout states,
20 Contents hierarchy/panel states, search completion/Escape/focus, stable modal
controls and background locking, Contents from the bottom and chapter selection,
task/product routing, continuation/Back to top, readable/repeatable Copy feedback,
stationary Copy placement while wide code scrolls, and a
shortcut opening search during smooth travel. Separate rendered motion probes
exercise actual entry/exit, reversal, reduced motion and controlled error recovery;
these are not performance certification or a substitute for the executable suite.

## Authorized in-app browser

Use the existing permitted IAB. Do not launch an external browser or install a
local runtime on Windows. In its documented CUA Node session, with an existing
`browser` binding and `suiteURL` set to this module's absolute file URL:

```js
const {runUiRegressions} = await import(suiteURL);
const baseURL = 'http://127.0.0.1:8765/';
const viewport = await browser.capabilities.get('viewport');
const tab = await browser.tabs.new();
await tab.goto(new URL('design/handbook-lab/index.html',baseURL).href);
const nativeTab = await cua.getTab(tab.id,{browser:browser.browserId});
const cdp = await tab.capabilities.get('cdp');
const savedClipboard = await tab.clipboard.read(); // keep private; never print
try {
  const report = await runUiRegressions({
    page: {
      goto: async url => {
        if (await tab.url() === url) await tab.reload();
        else await tab.goto(url);
      },
      evaluate: (...args) => tab.playwright.evaluate(...args),
      getByRole: (...args) => tab.playwright.getByRole(...args),
      locator: (...args) => tab.playwright.locator(...args)
    },
    waitForPageEntry: () => cdp.send('Runtime.evaluate', {
      expression: `(async()=>{
        await document.fonts.ready;
        await new Promise(resolve=>requestAnimationFrame(resolve));
        await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));
        await new Promise(resolve=>requestAnimationFrame(resolve));
        return true;
      })()`, awaitPromise:true, returnByValue:true
    },{timeoutMs:5000}),
    pressKey: key => nativeTab.pressKey(null,key.replace(/^Control\+/,'Ctrl+')),
    setViewport: size => viewport.set(size), baseURL,
    settle: () => tab.playwright.domSnapshot(),
    onResult: row => nodeRepl.write({id:row.id,status:row.status})
  });
  nodeRepl.write(report);
} finally {
  await tab.clipboard.write(savedClipboard);
  await viewport.reset();
  await tab.close();
}
```

Read the browser/viewport/CDP documentation first. The page-entry hook establishes
an independent, font-ready fixture before each case; it does not delay actions
in the product. Active entry/interruption is tested separately. The IAB's
read-only DOM evaluator does not expose `document.getAnimations`, so its adapter
uses supported read-only CDP observation. Native page keys must not be replaced
by a locator that refocuses an offscreen destination during the travel test.
If the runtime lacks native keys, report that case unavailable.

Copy checks use the actual Clipboard API; preserve/restore the existing clipboard
as shown. Keep full reports outside `web/`. Reports retain requested/actual
viewport widths because IAB can round by one CSS pixel. Coverage does not certify
every layout, physical touch/wheel, native zoom, screen readers or physical FPS.

## Optional Linux runner handoff

`scripts/run-browser-regressions.mjs` runs the same cases with Playwright's
documented library API and refuses Windows launch. Prerequisites are an isolated
Linux environment with Node 24, resolvable `playwright@1.64.1`, Chromium and its
OS libraries. It was syntax-checked but **not executed**; no dependency/runtime
was installed. No browser permissions are automatically granted.

With a static server serving `web/` on port 8765:

```sh
UI_BASE_URL=http://127.0.0.1:8765/ UI_REPORT=/tmp/database-notes-browser-report.json node scripts/run-browser-regressions.mjs
```

The runner writes its report and exits nonzero on failure. Point it at the
version under test: the older production release will fail expectations for
unpublished features. No CI workflow is supplied or enabled. The separate
`check-ui-regressions.py` remains a validator of recorded evidence.
