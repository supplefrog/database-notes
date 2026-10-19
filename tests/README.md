# Executable browser regressions

`ui-regressions.mjs` performs fresh browser navigation, keyboard/pointer actions
and DOM measurements through an injected adapter. It does not read saved QA
observations. Run it for changes that can affect the UI; documentation-only
changes do not need the full browser pass. Static build/link checks are separate.

The current candidate has 25 executable groups: 78 representative layout states,
20 Contents hierarchy/panel states, search completion/Escape/focus, stable modal
controls and background locking, Contents from the bottom and chapter selection,
task/product routing, continuation, history-neutral Back to top with real browser
Back/Forward, redundant entry-arrow omission, readable/repeatable Copy feedback,
stationary Copy placement while wide code scrolls, eight Home-to-reader entry states,
related-task product/subject switches, a history-neutral database chooser, immediate
keyboard exclusion of its exiting options, current-section tracking with scroll and
Resume, and a shortcut opening search during smooth travel. Separate rendered motion probes
exercise actual entry/exit, reversal, reduced motion and controlled error recovery;
these are not performance certification or a substitute for the executable suite.

## Authorized in-app browser

Use the existing permitted IAB. Do not launch an external browser or install a
local runtime on Windows. In its documented CUA Node session, with an existing
`browser` binding and `suiteURL` set to this module's absolute file URL:

```js
const {runUiRegressions,observeCopyFeedback} = await import(suiteURL);
const baseURL = 'http://127.0.0.1:8765/';
const viewport = await browser.capabilities.get('viewport');
const tab = await browser.tabs.get(tabId); // the displayed IAB QA tab
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
      goBack: () => tab.back(),
      goForward: () => tab.forward(),
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
    slowRegistryBaseURL: 'http://127.0.0.1:8767/',
    startCopyObservation: async () => (await cdp.send('Runtime.evaluate', {
      expression:'('+observeCopyFeedback.toString()+')()',
      awaitPromise:true,returnByValue:true
    },{timeoutMs:5000})).result.value,
    readReadingLocation: async () => (await cdp.send('Runtime.evaluate', {
      expression:'JSON.parse(localStorage.getItem("handbook-reading-location-v1")||"null")',
      returnByValue:true
    })).result.value,
    readHistory: async () => (await cdp.send('Runtime.evaluate', {
      expression: '({url:location.href,historyLength:history.length})',
      returnByValue:true
    })).result.value,
    pressKey: key => nativeTab.pressKey(null,key.replace(/^Control\+/,'Ctrl+')),
    wheel: async delta => {
      const m = await tab.playwright.evaluate(() => { const r=document.querySelector('.reader').getBoundingClientRect(); return {x:r.x+r.width/2,h:innerHeight}; });
      await nativeTab.scroll([m.x,Math.min(400,m.h/2)],delta<0?'up':'down',Math.abs(delta)/m.h);
    },
    setViewport: size => viewport.set(size), baseURL,
    settle: () => tab.playwright.domSnapshot(),
    onResult: row => nodeRepl.write({id:row.id,status:row.status})
  });
  nodeRepl.write(report);
} finally {
  if (savedClipboard.length) await tab.clipboard.write(savedClipboard);
  else await tab.clipboard.writeText('');
  await viewport.reset();
  await tab.close();
}
```

Read the browser/viewport/CDP documentation first. Use the same displayed IAB QA tab for viewport changes and native keys; verify actual innerWidth before trusting layout results. Both local server origins require their applicable browser approval. Explicit `caseIds` can split the same suite into bounded batches; report all required groups before calling it a full pass. The page-entry hook establishes
an independent, font-ready fixture before each case; it does not delay actions
in the product. Active entry/interruption is tested separately. The IAB's
read-only DOM evaluator does not expose `document.getAnimations`, so its adapter
uses supported read-only CDP observation. The same adapter reads the current
document URL and session-history length; it does not inspect browsing history. Native page keys must not be replaced
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

Start the bounded slow-registry fixture as well as the ordinary server serving
`web/` on port 8765. It serves the actual public files and delays only registry
responses by one second; stop it after QA. No site output is copied or changed.

```sh
python tests/slow-registry-server.py --port 8767
```

For the optional Linux runner:

```sh
UI_BASE_URL=http://127.0.0.1:8765/ UI_SLOW_REGISTRY_BASE_URL=http://127.0.0.1:8767/ UI_REPORT=/tmp/database-notes-browser-report.json node scripts/run-browser-regressions.mjs
```

The runner writes its report and exits nonzero on failure. Point it at the
version under test: the older production release will fail expectations for
unpublished features. No CI workflow is supplied or enabled. The separate
`check-ui-regressions.py` remains a validator of recorded evidence.

## Regressions to avoid

**Validate a symbol's contribution before choosing its direction.** The old checks verified that repeated entry arrows were rendered and pointed right, while never asking whether they conveyed anything the link label and context did not. Task-directory headings, subject doors and Resume already name their action/destination; these now omit the redundant mark. `entry-links-omit-redundant-arrows` checks those surfaces and exercises a real destination. Preserve useful neighbors: previous/next task arrows convey ordered progression, disclosure carets convey expansion, and teaching-diagram arrows convey relationships. A global “no arrows” rule would be another error.

**Viewport actions must not become history destinations.** The old footer used a fragment link plus `history.pushState('#page-top')`; its test explicitly expected that hash. That made browser Back revisit the chapter's bottom. Back to top is now a native button, revealed only when its JavaScript action is available; activation changes scroll/focus without changing the current URL or adding history. `page-top-preserves-url-history-and-browser-back` enters a chapter from its index, reaches the footer without a fragment navigation, activates twice, checks unchanged URL/history length, then uses actual browser Back and Forward. Merely checking arrival at y=0 would miss the regression. Real page changes retain normal history. Same-document Contents, Search, citations/returns, prose anchors and Skip to content keep shareable URLs through replacement, without adding Back stops. `same-document-navigation-does-not-add-history-stops` exercises these sibling actions repeatedly at phone/wide widths, then actual Back/Forward and incoming deep-link entry. The earlier top-only test and this former sentence incorrectly treated every fragment as a meaningful history stop.

These incidents are failures to enforce the existing contribution and complete-navigation contract, not evidence that every site needs more icons, another navigation layer or a broader instruction checklist. Review necessity and navigation consequences while editing; do not turn a flawed implementation into a required test expectation.

**Test the route into content, not just movement after arrival.** The OS index repeats the chapter reader's Contents tree. Making that index the mandatory subject entry adds a page without a distinct decision or useful result. Database task pages contain comparison guidance, so they can remain optional references; product/chapter entry should be available directly from Home and the reader's Contents. The earlier suite started most flows inside a chapter and therefore passed the repaired rail while missing the extra Home → index → task/product → chapter friction. A full navigation regression must begin on Home, enter actual reading content with Contents available, switch subject/product without mandatory directory detours, and verify browser Back. An index is justified when it adds a real comparison or discovery task, not merely because a hierarchy has another level. The selected direct-entry treatment is covered by `home-to-reader-without-directory-gates` (four entry choices at phone/desktop widths and real Back), `reader-path-switches-keep-the-task-and-avoid-indexes`, and `database-chooser-is-an-accessible-history-neutral-disclosure`. Do not replace these journeys with assertions that a menu exists.


**Observe transient feedback and the internal control, not only its final box.** The old Copy test verified Copied/Retry and a fixed outer size but missed immediate Copying flashes and icon/text movement. `copy-active-feedback-does-not-flash-or-shift` observes mutations and rendered frames during actual repeated writes and reset. Fast writes must not flash progress; perceptible waits and failure/retry feedback remain valid. The shared I25 animation contract already required intermediate observation; this was an enforcement gap, not permission to add a duplicate rule.

**Resume must use current validated reading state at activation.** An initial link default is not a saved location. `resume-reading-keeps-database-and-section-in-both-layouts` uses a real database chapter/section, observes its saved state, then clicks Home's Resume before an intentionally delayed registry reply. It also checks restored Home at phone/wide widths. Direct incoming fragments, blocked/invalid storage and a clearly labeled starting fallback remain valid. This fixture specifically distinguishes the early-click repair from a settled-page test that passed the old implementation.

**Current section means the section being read.** The chapter-only mark did not identify a reader's position, and Resume only followed clicked fragments. `current-section-follows-links-scroll-and-resume-without-history` exercises section choices, actual Back to Home, Resume and real keyboard scrolling at phone/intermediate/wide widths. Exactly one section uses `aria-current="location"` alongside the chapter's `aria-current="page"`; its visible treatment includes weight and a marker. Ordinary scrolling updates validated local reading state without changing the URL or adding history. Existing direct fragments, citations, focus, meaningful page navigation and fast/slow Copy feedback remain required neighbors. Do not accept a clicked hash as evidence of the currently visible section.

**Manual input owns the viewport during animated navigation.** Native smooth scrolling alone did not yield to an opposing wheel in the reviewed Chromium, while PageUp already worked. The existing modal-interruption test covered only the explicit modal freeze. `manual-wheel-and-keys-interrupt-page-travel-without-resuming-it` requires actual wheel and page-key adapters, captures nonzero intermediate travel before input, checks continued ordinary scrolling, real Back/Resume, and rapid/repeated anchor reversal. It must fail as unavailable when real input or the active window is missing; synthetic scroll/wheel events and settled anchors do not establish takeover. Review touch/pan, pointer/scrollbar takeover and reduced-motion changes separately where supported. Stop the native transport without preventing ordinary input, stealing focus, restoring a stale destination or adding history. The existing motion contract already required this; no new shared instruction is needed.
