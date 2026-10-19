// Progressive enhancement only. Pages and every navigation link work without scripts.
// Pointer feedback stays quiet; keyboard input clears pointer markers before
// the browser moves focus. Programmatic restoration clears its target too.
document.addEventListener('pointerdown', event => event.target.closest('button')?.setAttribute('data-pointer-focus',''));
document.addEventListener('keydown', () => document.querySelectorAll('[data-pointer-focus]').forEach(element => element.removeAttribute('data-pointer-focus')), {capture:true});
const freezePageScroll = () => window.scrollTo({left:window.scrollX,top:window.scrollY,behavior:'instant'});
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
const normalize = s => s.toLocaleLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '');
const openSearch = async (trigger, pointer = false) => {
  if (!dialog || typeof dialog.showModal !== 'function' || document.querySelector('dialog[open]')) return;
  origin = trigger || document.activeElement;
  searchDestination = null;
  freezePageScroll();
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
  button.addEventListener('click', event => openSearch(button, event.detail > 0));
});
document.querySelector('[data-search-close]')?.addEventListener('click', () => dialog.close());
dialog?.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); dialog.close(); } });
dialog?.addEventListener('close', () => {
  if (dialog.open) return;
  const destination = searchDestination || origin;
  searchDestination = null;
  origin = null;
  if (!document.querySelector('dialog[open]') && destination?.isConnected) { destination.removeAttribute('data-pointer-focus'); destination.focus({ preventScroll: true }); }
});
// Preserve native links/history while completing same-page search navigation.
results?.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  searchDestination = null;
  if (link.origin === location.origin && link.pathname === location.pathname && link.hash) {
    const target = document.getElementById(decodeFragment(link.hash));
    if (target) {
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      searchDestination = target;
    }
  }
  dialog.close();
});
document.addEventListener('keydown', event => {
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
input?.addEventListener('input', renderSearch);
input?.addEventListener('pointerdown', () => input.setAttribute('data-pointer-focus', ''));
input?.addEventListener('keydown', () => input.removeAttribute('data-pointer-focus'));

const chapter = document.body.dataset.chapter;
const key = 'handbook-reading-location-v1';
const validId = id => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
async function loadRegistry() {
  try { const response = await fetch(`${root}registry.json`); return response.ok ? await response.json() : null; }
  catch { return null; }
}
loadRegistry().then(registry => {
  if (!registry) return;
  const resume = document.querySelector('[data-resume]');
  if (resume) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value && validId(value.chapter) && Object.hasOwn(registry,value.chapter) && (!value.heading || registry[value.chapter].includes(value.heading))) {
        resume.href = `${root}chapters/${value.chapter}.html${value.heading ? `#${encodeURIComponent(value.heading)}` : ''}`;
      }
    } catch { /* Blocked or invalid storage leaves the real fallback link. */ }
  }
  if (!chapter || !Object.hasOwn(registry,chapter)) return;
  const record = () => {
    const heading = decodeFragment(location.hash);
    const value = { chapter };
    if (heading && registry[chapter].includes(heading)) value.heading = heading;
    try { localStorage.setItem(key,JSON.stringify(value)); } catch { /* Reading never depends on storage. */ }
  };
  record();
  window.addEventListener('hashchange',record);
});

// Exported citation and return links point to real IDs. Focus before moving the
// hash, then let the browser perform ordinary anchor/history navigation.
document.querySelectorAll('a.citation-ref,a.figure-source-ref,a.citation-return').forEach(link => {
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(decodeFragment(link.hash));
    if (!target) return;
    event.preventDefault();
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex','-1');
    target.focus({ preventScroll:true });
    if (location.hash !== link.hash) location.hash = link.hash;
    target.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth'});
  });
});
// Keep the footer's current-page return explicit, including repeated activation.
document.querySelector('.site-footer a[href="#page-top"]')?.addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = document.getElementById('page-top');
  if (!target) return;
  event.preventDefault();
  target.focus({preventScroll:true});
  if (location.hash !== '#page-top') history.pushState(null,'','#page-top');
  window.scrollTo({top:0,left:0,behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth'});
});
// One native contents tree serves both the wide rail and narrow overlay.
const contents = document.querySelector('.reader-controls > .contents-menu');
const controls = document.querySelector('.reader-controls');
const wideReader = window.matchMedia('(min-width:1101px)');
const fitContentsPanel = () => {
  if (!contents || wideReader.matches || !contents.open) return;
  const rect = controls.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
  const upward = below < 180 && above > below;
  contents.classList.toggle('opens-up', upward);
  contents.style.setProperty('--contents-room', `${Math.max(80, upward ? above : below)}px`);
};
contents?.addEventListener('toggle',fitContentsPanel);
window.addEventListener('resize',fitContentsPanel);
window.addEventListener('scroll',fitContentsPanel,{passive:true});
for (const summary of contents?.querySelectorAll('summary') || []) {
  summary.addEventListener('pointerdown',()=>summary.setAttribute('data-pointer-focus',''));
  summary.addEventListener('keydown',()=>summary.removeAttribute('data-pointer-focus'));
}
const setReaderOffset = () => {
  if (controls) document.documentElement.style.setProperty('--reader-offset', wideReader.matches ? '24px' : `${controls.offsetHeight + 16}px`);
};
const syncContents = () => {
  if (!contents) return;
  const focused = document.activeElement;
  contents.open = wideReader.matches;
  if (!wideReader.matches && contents.contains(focused) && focused !== contents.querySelector('summary')) { contents.querySelector('summary').removeAttribute('data-pointer-focus'); contents.querySelector('summary').focus({preventScroll:true}); }
  if (wideReader.matches && focused === contents.querySelector('summary')) contents.querySelector('[aria-current="page"]').focus({preventScroll:true});
  setReaderOffset();
};
syncContents();
wideReader.addEventListener('change',syncContents);
contents?.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!wideReader.matches && contents.open) {
    event.preventDefault(); contents.open = false;
    contents.querySelector('summary').removeAttribute('data-pointer-focus');
    contents.querySelector('summary').focus({preventScroll:true});
  } else if (wideReader.matches) {
    const group = event.target.closest('.contents-group[open]');
    if (group) { event.preventDefault(); group.open = false; group.querySelector('summary').removeAttribute('data-pointer-focus'); group.querySelector('summary').focus({preventScroll:true}); }
  }
});
contents?.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!wideReader.matches) contents.open = false;
  if (link.pathname === location.pathname && link.hash) {
    const target = document.getElementById(decodeFragment(link.hash));
    if (target) {
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      event.preventDefault();
      target.focus({preventScroll:true});
      if (location.hash !== link.hash) location.hash = link.hash;
      target.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth'});
    }
  }
});
document.addEventListener('click', event => {
  if (contents && !wideReader.matches && !contents.contains(event.target)) contents.open = false;
});
if (controls && typeof ResizeObserver === 'function') new ResizeObserver(setReaderOffset).observe(controls);
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
    label.textContent = state === 'pending' ? 'Copying…' : state === 'success' ? 'Copied' : state === 'error' ? 'Retry' : 'Copy';
    status.textContent = state === 'pending' ? 'Copying code' : state === 'success' ? 'Copied' : state === 'error' ? 'Could not copy' : '';
    button.setAttribute('aria-label',state === 'error' ? 'Retry copying this code' : 'Copy this code');
    button.title = state === 'error' ? 'Could not copy — try again' : 'Copy code';
    if (state) { button.dataset.copyState = state; status.dataset.copyState = state; }
    else { delete button.dataset.copyState; delete status.dataset.copyState; }
  }
  let resetCopy, copyAttempt = 0;
  button.addEventListener('click',async () => {
    const attempt = ++copyAttempt;
    clearTimeout(resetCopy); showCopyState('pending');
    try {
      await navigator.clipboard.writeText(text);
      if (attempt !== copyAttempt) return;
      showCopyState('success');
    } catch {
      if (attempt !== copyAttempt) return;
      showCopyState('error');
    }
    resetCopy = setTimeout(() => showCopyState(null),2000);
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
  trigger.addEventListener('click', () => {
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
      fit.addEventListener('click', () => {
        const fitted = canvas.classList.toggle('fit-width');
        fit.textContent = fitted ? 'Actual size' : 'Fit to width';
        canvas.scrollLeft = 0;
      });
      close.addEventListener('click', () => viewer.close());
      viewer.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) { trigger.removeAttribute('data-pointer-focus'); trigger.focus({ preventScroll: true }); } });
    }
    const canvas = viewer.querySelector('.figure-canvas');
    canvas.classList.remove('fit-width'); canvas.scrollLeft = 0;
    viewer.querySelector('button:not([data-figure-close])').textContent = 'Fit to width';
    freezePageScroll();
    viewer.showModal();
  });
}
