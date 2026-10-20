// Each reader mount owns its listeners, observers and scheduled work.
// Chapter navigation tears them down before enhancing the next authored main.
(() => {
function mountHandbook(){
 document.documentElement.toggleAttribute('data-scrollbar-motion',typeof CSS.registerProperty==='function'&&CSS.supports('selector(::-webkit-scrollbar)')&&CSS.supports('background','color-mix(in srgb,black 50%,transparent)'));
 const scope=new AbortController(),observers=[],frames=new Set(),timers=new Set();
 const on=(target,type,callback,options={})=>target?.addEventListener(type,callback,{...(typeof options==='boolean'?{capture:options}:options),signal:scope.signal});
 const makeObserver=(Type,callback)=>{const observer=new Type(callback);observers.push(observer);return observer;};
 const requestAnimationFrame=callback=>{const id=window.requestAnimationFrame(time=>{frames.delete(id);if(!scope.signal.aborted)callback(time);});frames.add(id);return id;};
 const setTimeout=(callback,delay)=>{const id=window.setTimeout(()=>{timers.delete(id);if(!scope.signal.aborted)callback();},delay);timers.add(id);return id;};
// Progressive enhancement only. Pages and every navigation link work without scripts.
// Pointer feedback stays quiet; keyboard input clears pointer markers before
// the browser moves focus. Programmatic restoration clears its target too.
on(document,'pointerdown', event => event.target.closest('button')?.setAttribute('data-pointer-focus',''));
on(document,'keydown', () => document.querySelectorAll('[data-pointer-focus]').forEach(element => element.removeAttribute('data-pointer-focus')), {capture:true});
// Native smooth scrolling does not reliably yield to wheel input in every browser.
// Remember our last transport until takeover: cancelling an already settled one
// is harmless, and no stale scrollend event/timer can clear a newer command.
let authoredPageScroll = false;
let contentsGlass = null;
const pageScrollMotion = window.matchMedia('(prefers-reduced-motion:reduce)');
const freezePageScroll = () => {
  authoredPageScroll = false;
  window.scrollTo({left:window.scrollX,top:window.scrollY,behavior:'instant'});
};
const pageScrollBehavior = () => {
  authoredPageScroll = !pageScrollMotion.matches;
  return authoredPageScroll ? 'smooth' : 'instant';
};
const interruptPageScroll = () => {
  if (!authoredPageScroll) return;
  freezePageScroll();
  scheduleCurrentSection();
};
// Stop only the authored transport; never prevent the input's normal action.
on(window,'wheel', event => {
  if (event.deltaX || event.deltaY) interruptPageScroll();
}, {capture:true,passive:true});
on(window,'touchstart',interruptPageScroll,{capture:true,passive:true});
on(window,'pointerdown',interruptPageScroll,{capture:true,passive:true});
on(window,'keydown', event => {
  if (event.defaultPrevented || event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="slider"],[role="spinbutton"]')) return;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End',' ','Escape','Tab'].includes(event.key)) interruptPageScroll();
});
on(pageScrollMotion,'change',event => { if (event.matches) interruptPageScroll(); });
const root = document.body.dataset.root || './';
const dialog = document.querySelector('.search-dialog');
const input = document.querySelector('#handbook-query');
const results = document.querySelector('.search-results');
const status = document.querySelector('.search-count');
let origin = null;
let searchDestination = null;
let searchData = null;
let searchFailed = false;
const decodeFragment = hash => {
  try { return decodeURIComponent(hash.replace(/^#/, '')); }
  catch { return ''; }
};
// Position changes keep a shareable fragment without creating another Back stop.
const samePageTarget = link => link.origin === location.origin && link.pathname === location.pathname && link.search === location.search && link.hash ? document.getElementById(decodeFragment(link.hash)) : null;
let recordReadingLocation = () => {};
const normalize = s => s.toLocaleLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '');
const openSearch = async (trigger, pointer = false) => {
  if (!dialog || typeof dialog.showModal !== 'function' || document.querySelector('dialog[open]')) return;
  origin = trigger || document.activeElement;
  searchDestination = null;
  freezePageScroll();
  contentsGlass?.follow();
  dialog.showModal();
  input.toggleAttribute('data-pointer-focus', pointer);
  input.value = '';
  results.replaceChildren();
  status.textContent = 'Type to search all chapters.';
  input.focus();
  if (searchData === null) {
    searchFailed = false;
    status.textContent = 'Loading search…';
    try {
      const response = await fetch(`${root}search-index.json`);
      if (!response.ok) throw Error('Search index unavailable');
      searchData = await response.json();
    } catch { searchFailed = true; }
  }
  renderSearch();
};
document.querySelectorAll('[data-search-open]').forEach(button => {
  if (typeof dialog?.showModal !== 'function') return;
  button.hidden = false;
  on(button,'click', event => openSearch(button, event.detail > 0));
});
on(document.querySelector('[data-search-close]'),'click', () => dialog.close());
on(dialog,'keydown', event => { if (event.key === 'Escape') { event.preventDefault(); dialog.close(); } });
on(dialog,'close', () => {
  if (dialog.open) return;
  // Same-page results already received focus through shared navigation.
  // A later close event must not steal it back after another accepted action.
  const destination = searchDestination ? null : origin;
  searchDestination = null;
  origin = null;
  if (!document.querySelector('dialog[open]') && destination?.isConnected) { destination.removeAttribute('data-pointer-focus'); destination.focus({ preventScroll: true }); }
});
// Close search and restore focus to a same-page result; shared navigation below
// owns its URL/scroll behavior. Cross-page and modified links stay native.
on(results,'click', event => {
  const link = event.target.closest('a');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  searchDestination = null;
  if (samePageTarget(link)) {
    const target = samePageTarget(link);
    if (target) {
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      searchDestination = target;
    }
  }
  dialog.close();
});
on(document,'keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && typeof dialog?.showModal === 'function') { event.preventDefault(); if (!dialog.open) openSearch(document.activeElement); }
});
function renderSearch() {
  results.replaceChildren();
  results.scrollTop = 0;
  const query = normalize(input.value.trim());
  if (!searchData) {
    status.textContent = searchFailed ? 'Search is unavailable. Browse the subject links instead.' : 'Loading search…';
    return;
  }
  if (!query) { status.textContent = 'Type to search all chapters.'; return; }
  const words = query.split(/\s+/).filter(Boolean);
  const matches = searchData.map(item => {
    const title = normalize(item.title), context = normalize(item.context), text = normalize(item.text);
    if (!words.every(word => title.includes(word) || context.includes(word) || text.includes(word))) return null;
    return { item, score: words.reduce((n,w) => n + (title.includes(w)?8:0) + (context.includes(w)?3:0) + (text.includes(w)?1:0),0) };
  }).filter(Boolean).sort((a,b) => b.score-a.score).slice(0,30);
  status.textContent = matches.length ? `${matches.length} result${matches.length===1?'':'s'}${matches.length===30?' shown':''}.` : 'No matching sections. Try another topic or product.';
  for (const { item } of matches) {
    const li = document.createElement('li'), link = document.createElement('a');
    link.href = `${root}${item.url}`;
    const name = document.createElement('strong'), context = document.createElement('span');
    name.textContent = item.title; context.textContent = item.context;
    link.append(name,context); li.append(link); results.append(li);
  }
}
on(input,'input', renderSearch);
on(input,'pointerdown', () => input.setAttribute('data-pointer-focus', ''));
on(input,'keydown', () => input.removeAttribute('data-pointer-focus'));

const chapter = document.body.dataset.chapter;
const key = 'handbook-reading-location-v1';
const validId = id => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
async function loadRegistry() {
  try { const response = await fetch(`${root}registry.json`); return response.ok ? await response.json() : null; }
  catch { return null; }
}
const resume = document.querySelector('[data-resume]');
const resumeFallback = resume?.getAttribute('href');
let readingRegistry;
const refreshResume = () => {
  if (!resume || readingRegistry === undefined) return;
  let destination = resumeFallback;
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (readingRegistry && value && validId(value.chapter) && Object.hasOwn(readingRegistry,value.chapter) && (!value.heading || readingRegistry[value.chapter].includes(value.heading))) {
      destination = `${root}chapters/${value.chapter}.html${value.heading ? `#${encodeURIComponent(value.heading)}` : ''}`;
    }
  } catch { /* Blocked or invalid storage leaves a real starting link. */ }
  resume.href = destination;
  resume.textContent = destination === resumeFallback ? 'Start reading' : 'Resume reading';
};
const registryReady = loadRegistry().then(registry => {
  if(scope.signal.aborted)return;
  readingRegistry = registry;
  refreshResume();
  if (!registry || !chapter || !Object.hasOwn(registry,chapter)) return;
  let lastSaved;
  recordReadingLocation = headingId => {
    const heading = typeof headingId === 'string' ? headingId : decodeFragment(location.hash);
    const value = { chapter };
    if (heading && registry[chapter].includes(heading)) value.heading = heading;
    const serialized = JSON.stringify(value);
    if (serialized === lastSaved) return;
    try { localStorage.setItem(key,serialized); lastSaved = serialized; } catch { /* Reading never depends on storage. */ }
  };
  recordReadingLocation();
  scheduleCurrentSection();
  on(window,'hashchange',recordReadingLocation);
});
// A restored Home or another tab's reading change must not retain an old route.
on(window,'pageshow',refreshResume);
on(window,'focus',refreshResume);
on(window,'storage',event => { if (event.key === key || event.key === null) refreshResume(); });
on(resume,'click', async event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (readingRegistry !== undefined) { refreshResume(); return; }
  // An early click must wait for validation rather than follow the OS fallback.
  event.preventDefault();
  await registryReady;
  refreshResume();
  location.assign(resume.href);
});

// Apply one rule to Contents, search, citations, prose anchors and Skip to content.
// Real hrefs preserve no-JS reading, copied deep links and modified/new-tab clicks.
on(document,'click', event => {
  const link = event.target.closest('a');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
  const target = samePageTarget(link);
  if (!target) return;
  event.preventDefault();
  if (location.href !== link.href) history.replaceState(history.state,'',link.href);
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
  target.removeAttribute('data-pointer-focus');
  target.focus({preventScroll:true});
  target.scrollIntoView({block:'start',behavior:pageScrollBehavior()});
  contentsGlass?.select(link,authoredPageScroll);
  recordReadingLocation();
});
// Returning to the top is a viewport action, not a document/history destination.
const pageTopAction = document.querySelector('[data-page-top]');
if (pageTopAction) {
  pageTopAction.hidden = false;
  const narrowTopAction = matchMedia('(max-width:1100px)');
  let topVisible, topMaterial;
  import('./page-top-glass.mjs').then(({attachPageTopGlass})=>{if(scope.signal.aborted)return;topMaterial=attachPageTopGlass(pageTopAction,{signal:scope.signal});topMaterial.setVisible(!!topVisible);}).catch(()=>{});
  const updateTopAction = () => {
    const maxScroll = Math.max(0,document.documentElement.scrollHeight-innerHeight);
    const atBottom = maxScroll > 0 && scrollY > 0 && maxScroll-scrollY <= 1;
    const visible = (scrollY > Math.max(1500, innerHeight * 2.5) || atBottom) && !(narrowTopAction.matches && document.querySelector('.contents-menu[open]'));
    if(visible===topVisible)return;
    topVisible=visible;
    topMaterial?.setVisible(visible);
    pageTopAction.toggleAttribute('data-visible',visible);
    pageTopAction.inert = !visible;
    pageTopAction.setAttribute('aria-hidden',String(!visible));
  };
  on(window,'scroll',updateTopAction,{passive:true});
  on(window,'resize',updateTopAction);
  on(window,'pageshow',updateTopAction);
  makeObserver(ResizeObserver,updateTopAction).observe(document.body);
  const topContents = document.querySelector('.contents-menu');
  if(topContents)makeObserver(MutationObserver,updateTopAction).observe(topContents,{attributes:true,attributeFilter:['open','data-closing']});
  updateTopAction();
  on(pageTopAction,'click', () => {
    const target = document.getElementById('page-top');
    if (!target) return;
    target.focus({preventScroll:true});
    contentsGlass?.follow();
    window.scrollTo({top:0,left:0,behavior:pageScrollBehavior()});
  });
}
// The database chooser opens routes directly; its disclosure is not history.
function closeSubjectPathMenu(menu) {
  const summary = menu.querySelector('summary'), options = menu.querySelector('.subject-path-options');
  if (options.contains(document.activeElement)) {
    summary.removeAttribute('data-pointer-focus');
    summary.focus({preventScroll:true});
  }
  options.inert = true;
  menu.open = false;
}
for (const menu of document.querySelectorAll('.subject-path-menu')) {
  const summary = menu.querySelector('summary'), options = menu.querySelector('.subject-path-options');
  // Exit paint may remain, but its links must leave keyboard/AT interaction now.
  const syncInteraction = () => { options.inert = !menu.open; };
  syncInteraction();
  makeObserver(MutationObserver,syncInteraction).observe(menu,{attributes:true,attributeFilter:['open']});
  on(summary,'pointerdown', () => summary.setAttribute('data-pointer-focus',''));
  on(menu,'keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      event.preventDefault(); closeSubjectPathMenu(menu);
      summary.removeAttribute('data-pointer-focus'); summary.focus({preventScroll:true});
    }
  });
}
on(document,'click', event => {
  for (const menu of document.querySelectorAll('.subject-path-menu[open]')) {
    if (!menu.contains(event.target)) closeSubjectPathMenu(menu);
  }
});
// One native contents tree serves both the wide rail and narrow overlay.
const contents = document.querySelector('.reader-controls > .contents-menu');
const controls = document.querySelector('.reader-controls');
const wideReader = window.matchMedia('(min-width:1101px)');
// Keep the actual panel alive through exit; native details hiding happens last.
const contentsPanel = contents?.querySelector(':scope>nav');
const contentsSummary = contents?.querySelector(':scope>summary');
let contentsMotion, contentsCommand = 0;
const exitProperties = ['--contents-exit-x','--contents-exit-y','--contents-exit-width','--contents-exit-height'];
const releaseContentsExit = () => {
  contents?.classList.remove('contents-exiting');
  for(const property of exitProperties)contents?.style.removeProperty(property);
};
const resetContentsMotion = () => {
  ++contentsCommand; contentsMotion?.cancel(); contentsMotion=null;
  contents?.removeAttribute('data-closing'); releaseContentsExit();
  contentsPanel?.style.removeProperty('opacity');
  contentsSummary?.removeAttribute('aria-expanded');
  if(contentsPanel){contentsPanel.inert=!contents.open;contentsPanel.removeAttribute('aria-hidden');}
};
const closeReaderContents = () => {
  if(!contentsPanel||wideReader.matches||!contents.open||contents.hasAttribute('data-closing'))return;
  const id=++contentsCommand,box=contentsPanel.getBoundingClientRect(),opacity=getComputedStyle(contentsPanel).opacity;
  contentsMotion?.cancel();
  exitProperties.forEach((property,index)=>contents.style.setProperty(property,`${[box.x,box.y,box.width,box.height][index]}px`));
  contents.classList.add('contents-exiting'); contents.setAttribute('data-closing','');
  contentsSummary.setAttribute('aria-expanded','false'); contentsPanel.inert=true;contentsPanel.setAttribute('aria-hidden','true');
  const finish=()=>{if(id!==contentsCommand)return;contents.open=false;resetContentsMotion();};
  if(pageScrollMotion.matches||!contentsPanel.animate){finish();return;}
  contentsMotion=contentsPanel.animate({opacity:[opacity,0]},{duration:180,easing:'ease-out',fill:'forwards'});
  contentsMotion.finished.then(finish,()=>{});
};
if(contentsPanel){
  contents.setAttribute('data-lifecycle','');
  on(contentsSummary,'click',event=>{
    if(wideReader.matches)return;
    event.preventDefault();
    if(contents.open&&!contents.hasAttribute('data-closing')){closeReaderContents();return;}
    interruptPageScroll();
    const from=contentsPanel.getBoundingClientRect(),opacity=contents.open?getComputedStyle(contentsPanel).opacity:0;
    const reversing=contents.hasAttribute('data-closing');
    resetContentsMotion();contents.open=true;contentsPanel.inert=false;
    fitContentsPanel();const to=contentsPanel.getBoundingClientRect();
    if(!pageScrollMotion.matches){
      const offset=reversing?`${from.x-to.x}px ${from.y-to.y}px`:`0px ${contents.classList.contains('opens-up')?5:-5}px`;
      contentsMotion=contentsPanel.animate({opacity:[opacity,1],translate:[offset,'0px 0px']},{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
    }
  });
  makeObserver(MutationObserver,()=>{contentsPanel.inert=!contents.open||contents.hasAttribute('data-closing');}).observe(contents,{attributes:true,attributeFilter:['open']});
  on(window,'resize',()=>{const closing=contents.hasAttribute('data-closing');resetContentsMotion();if(closing)contents.open=false;});
  on(pageScrollMotion,'change',event=>{if(event.matches){const closing=contents.hasAttribute('data-closing');resetContentsMotion();if(closing)contents.open=false;}});
}

const fitContentsPanel = () => {
  if (!contents || wideReader.matches || (!contents.open || contents.hasAttribute('data-closing'))) return;
  const rect = controls.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
  const upward = below < 180 && above > below;
  contents.classList.toggle('opens-up', upward);
  contents.style.setProperty('--contents-room', `${Math.max(80, upward ? above : below)}px`);
};
on(contents,'toggle',fitContentsPanel);
on(window,'resize',fitContentsPanel);
on(window,'scroll',fitContentsPanel,{passive:true});
for (const summary of contents?.querySelectorAll('summary') || []) {
  on(summary,'pointerdown',()=>summary.setAttribute('data-pointer-focus',''));
  on(summary,'keydown',()=>summary.removeAttribute('data-pointer-focus'));
}
const setReaderOffset = () => {
  if (controls) document.documentElement.style.setProperty('--reader-offset', wideReader.matches ? '24px' : `${controls.offsetHeight + 16}px`);
};
const syncContents = () => {
  if (!contents) return;
  const focused = document.activeElement;
  resetContentsMotion();
  contents.open = wideReader.matches;
  if (!wideReader.matches && contents.contains(focused) && focused !== contents.querySelector('summary')) { contents.querySelector('summary').removeAttribute('data-pointer-focus'); contents.querySelector('summary').focus({preventScroll:true}); }
  if (wideReader.matches && focused === contents.querySelector('summary')) contents.querySelector('[aria-current="page"]').focus({preventScroll:true});
  setReaderOffset();
};
syncContents();
on(wideReader,'change',syncContents);
on(contents,'keydown', event => {
  if (event.key !== 'Escape') return;
  if (!wideReader.matches && contents.open) {
    event.preventDefault(); closeReaderContents();
    contents.querySelector('summary').removeAttribute('data-pointer-focus');
    contents.querySelector('summary').focus({preventScroll:true});
  } else if (wideReader.matches) {
    const group = event.target.closest('.contents-group[open]');
    if (group) { event.preventDefault(); group.open = false; group.querySelector('summary').removeAttribute('data-pointer-focus'); group.querySelector('summary').focus({preventScroll:true}); }
  }
});
on(contents,'click', event => {
  const link = event.target.closest('a');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!wideReader.matches) closeReaderContents();
});
on(document,'click', event => {
  if (contents && !wideReader.matches && !contents.contains(event.target)) closeReaderContents();
});
if (controls && typeof ResizeObserver === 'function') makeObserver(ResizeObserver,setReaderOffset).observe(controls);
// The section being read is local reading state, independent of URL/history.
// Follow ordinary scrolling as well as links; never scroll or move focus here.
const sectionEntries = [...document.querySelectorAll('.chapter-sections a')].map(link => ({link,target:document.getElementById(decodeFragment(link.hash))})).filter(entry => entry.target);
let sectionFrame = 0;
function scheduleCurrentSection() {
  if (!sectionEntries.length || sectionFrame) return;
  sectionFrame = requestAnimationFrame(() => {
    sectionFrame = 0;
    const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reader-offset')) || 24;
    const readingLine = Math.min(innerHeight / 3, offset + 32);
    let current = sectionEntries[0];
    for (const entry of sectionEntries) {
      if (entry.target.getBoundingClientRect().top > readingLine) break;
      current = entry;
    }
    if (scrollY > 0 && scrollY + document.documentElement.clientHeight >= document.documentElement.scrollHeight - 2) current = sectionEntries.at(-1);
    for (const entry of sectionEntries) {
      if (entry === current) entry.link.setAttribute('aria-current','location');
      else entry.link.removeAttribute('aria-current');
    }
    recordReadingLocation(current.target.id);
    contentsGlass?.read({current:current.link,position:scrollY,readingLine,transportActive:authoredPageScroll});
  });
}
on(window,'scroll',scheduleCurrentSection,{passive:true});
on(window,'resize',scheduleCurrentSection);
on(window,'pageshow',scheduleCurrentSection);
on(window,'load',scheduleCurrentSection);
document.fonts?.ready.then(()=>{if(!scope.signal.aborted)scheduleCurrentSection();});
scheduleCurrentSection();
for (const pre of document.querySelectorAll('.prose pre')) {
  const text = pre.textContent;
  const block = document.createElement('div'); block.className = 'code-block';
  const status = document.createElement('span'); status.className = 'copy-status';
  status.setAttribute('role','status'); status.setAttribute('aria-atomic','true');
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'copy-button';
  button.setAttribute('aria-label','Copy this code'); button.title = 'Copy code';
  button.innerHTML = '<svg class="copy-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg><svg class="copy-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><svg class="copy-error" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg><span class="copy-label">Copy</span>';
  const label = button.querySelector('.copy-label');
  function showCopyState(state) {
    label.textContent = state === 'pending' ? 'Copying' : state === 'success' ? 'Copied' : state === 'error' ? 'Retry' : 'Copy';
    status.textContent = state === 'pending' ? 'Copying code' : state === 'success' ? 'Copied' : state === 'error' ? 'Could not copy' : '';
    button.setAttribute('aria-label',state === 'error' ? 'Retry copying this code' : 'Copy this code');
    button.title = state === 'error' ? 'Could not copy — try again' : 'Copy code';
    if (state) { button.dataset.copyState = state; status.dataset.copyState = state; }
    else { delete button.dataset.copyState; delete status.dataset.copyState; }
  }
  let resetCopy, copyAttempt = 0;
  on(button,'click',async () => {
    const attempt = ++copyAttempt;
    if(scope.signal.aborted)return;
    clearTimeout(resetCopy);
    // Fast writes go straight to their result; repeated clicks keep that result
    // visible. Show progress only when there is actually time to perceive it.
    const pending = setTimeout(() => { if (attempt === copyAttempt) showCopyState('pending'); },150);
    try {
      await navigator.clipboard.writeText(text);
      if (scope.signal.aborted || attempt !== copyAttempt) return;
      if (button.dataset.copyState !== 'success') showCopyState('success');
    } catch {
      if (scope.signal.aborted || attempt !== copyAttempt) return;
      if (button.dataset.copyState !== 'error') showCopyState('error');
    } finally { clearTimeout(pending); }
    if (attempt === copyAttempt) resetCopy = setTimeout(() => showCopyState(null),2000);
  });
  pre.before(block); block.append(pre,status,button);
}

// The static text key remains complete without JavaScript. The optional modal
// shows the same authored SVG at a readable size, with deliberate local scrolling.
for (const figure of document.querySelectorAll('.schema-figure')) {
  const svg = figure.querySelector('svg');
  if (!svg || typeof HTMLDialogElement === 'undefined' || typeof HTMLDialogElement.prototype.showModal !== 'function') continue;
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'figure-enlarge'; trigger.textContent = 'Enlarge diagram';
  figure.querySelector('.tf-heading').after(trigger);
  let viewer;
  on(trigger,'click', () => {
    if (document.querySelector('dialog[open]')) return;
    if (!viewer) {
      viewer = document.createElement('dialog'); viewer.className = 'figure-dialog';
      const title = document.createElement('h2'); title.id = `${figure.id}-viewer-title`;
      title.textContent = figure.querySelector('.tf-heading strong').textContent;
      viewer.setAttribute('aria-labelledby', title.id);
      const close = document.createElement('button'); close.type = 'button';
      close.dataset.figureClose = ''; close.textContent = 'Close diagram'; close.autofocus = true;
      const top = document.createElement('div'); top.className = 'dialog-top'; top.append(title, close);
      const hint = document.createElement('p'); hint.textContent = 'Scroll the diagram horizontally, or fit it to the window.';
      const fit = document.createElement('button'); fit.type = 'button'; fit.textContent = 'Fit to width';
      const canvas = document.createElement('div'); canvas.className = 'teaching-figure figure-canvas';
      canvas.tabIndex = 0; canvas.setAttribute('role', 'region'); canvas.setAttribute('aria-label', 'Diagram, horizontally scrollable');
      const copy = svg.cloneNode(true);
      const ids = new Map([...copy.querySelectorAll('[id]')].map(el => [el.id, `${el.id}-enlarged`]));
      for (const element of [copy, ...copy.querySelectorAll('*')]) {
        if (ids.has(element.id)) element.id = ids.get(element.id);
        for (const name of ['aria-labelledby', 'aria-describedby']) {
          if (element.hasAttribute(name)) element.setAttribute(name, element.getAttribute(name).split(/\s+/).map(id => ids.get(id) || id).join(' '));
        }
      }
      canvas.append(copy); viewer.append(top, hint, fit, canvas); document.body.append(viewer);
      on(fit,'click', () => {
        const fitted = canvas.classList.toggle('fit-width');
        fit.textContent = fitted ? 'Actual size' : 'Fit to width';
        canvas.scrollLeft = 0;
      });
      on(close,'click', () => viewer.close());
      on(viewer,'close', () => { if (!document.querySelector('dialog[open]')) { trigger.removeAttribute('data-pointer-focus'); trigger.focus({ preventScroll: true }); } });
    }
    const canvas = viewer.querySelector('.figure-canvas');
    canvas.classList.remove('fit-width'); canvas.scrollLeft = 0;
    viewer.querySelector('button:not([data-figure-close])').textContent = 'Fit to width';
    freezePageScroll();
    viewer.showModal();
  });
}

// Enhance the existing chapter section list; no preview routes or controls.
if (sectionEntries.length) import('./contents-glass.mjs').then(({attachContentsGlass}) => {
  if(scope.signal.aborted)return;
  contentsGlass = attachContentsGlass({entries:sectionEntries,signal:scope.signal});
  scheduleCurrentSection();
}).catch(error => console.warn('Contents material unavailable',error));

 return ()=>{if(dialog?.open)dialog.close();scope.abort();resetContentsMotion();observers.forEach(observer=>observer.disconnect());frames.forEach(id=>window.cancelAnimationFrame(id));timers.forEach(id=>window.clearTimeout(id));document.querySelectorAll('.figure-dialog').forEach(dialog=>dialog.remove());};
}
let dispose=mountHandbook();
import('./reader-navigation.mjs').then(({installReaderNavigation})=>installReaderNavigation({remount(update){dispose();update();dispose=mountHandbook();}})).catch(error=>console.warn('Reader navigation unavailable',error));
})();
