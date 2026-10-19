// Progressive enhancement only. Pages and every navigation link work without scripts.
const root = document.body.dataset.root || './';
const dialog = document.querySelector('.search-dialog');
const input = document.querySelector('#handbook-query');
const results = document.querySelector('.search-results');
const status = document.querySelector('.search-count');
let origin = null;
let searchData = null;
let searchFailed = false;
const decodeFragment = hash => {
  try { return decodeURIComponent(hash.replace(/^#/, '')); }
  catch { return ''; }
};
const normalize = s => s.toLocaleLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '');
const openSearch = async trigger => {
  if (!dialog || typeof dialog.showModal !== 'function' || document.querySelector('dialog[open]')) return;
  origin = trigger || document.activeElement;
  dialog.showModal();
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
  button.addEventListener('click', () => openSearch(button));
});
document.querySelector('[data-search-close]')?.addEventListener('click', () => dialog.close());
dialog?.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); dialog.close(); } });
dialog?.addEventListener('close', () => { origin?.focus({ preventScroll: true }); origin = null; });
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && typeof dialog?.showModal === 'function') { event.preventDefault(); if (!dialog.open) openSearch(document.activeElement); }
});
function renderSearch() {
  results.replaceChildren();
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
    if (location.hash === link.hash) target.scrollIntoView();
    else location.hash = link.hash;
  });
});
// Keep native disclosure behavior, but dismiss overlays after a choice.
const menus = [...document.querySelectorAll('.reader-controls details')];
for (const menu of menus) {
  menu.addEventListener('toggle', () => {
    if (menu.open) for (const other of menus) if (other !== menu) other.open = false;
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      event.preventDefault();
      menu.open = false;
      menu.querySelector('summary').focus({ preventScroll: true });
    }
  });
  menu.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    menu.open = false;
    if (link.pathname === location.pathname && link.hash) {
      const target = document.getElementById(decodeFragment(link.hash));
      if (target) {
        if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }
  });
}
document.addEventListener('click', event => {
  for (const menu of menus) if (!menu.contains(event.target)) menu.open = false;
});
const controls = document.querySelector('.reader-controls');
if (controls) {
  const setOffset = () => document.documentElement.style.setProperty('--reader-offset', `${controls.offsetHeight + 16}px`);
  setOffset();
  if (typeof ResizeObserver === 'function') new ResizeObserver(setOffset).observe(controls);
}
for (const pre of document.querySelectorAll('.prose pre')) {
  const text = pre.textContent;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'copy-button'; button.textContent = 'Copy code';
  button.setAttribute('aria-label','Copy this code');
  button.setAttribute('aria-live','polite');
  button.addEventListener('click',async () => {
    try { await navigator.clipboard.writeText(text); button.textContent = 'Copied'; }
    catch { button.textContent = 'Could not copy'; }
    setTimeout(() => { button.textContent = 'Copy code'; },2000);
  });
  pre.append(button);
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
      viewer.addEventListener('close', () => trigger.focus({ preventScroll: true }));
    }
    const canvas = viewer.querySelector('.figure-canvas');
    canvas.classList.remove('fit-width'); canvas.scrollLeft = 0;
    viewer.querySelector('button:not([data-figure-close])').textContent = 'Fit to width';
    viewer.showModal();
  });
}
