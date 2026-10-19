// Shared live-browser checks. Adapters supply documented page/viewport methods.
// This module reads the current DOM and performs real user interactions; it
// does not consume saved measurements or decide which checks may be skipped.
export const widths = [320, 350, 351, 390, 419, 420, 680, 681, 768, 800, 801, 1024, 1440];
export function measureLayout() {
  const rect = selector => {
    const e = document.querySelector(selector); if (!e) return null;
    const r = e.getBoundingClientRect();
    return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
  };
  const hero = ['.eyebrow','h1','.hero-dek','.resume'].map(s => {
    const e = document.querySelector('.hero-copy '+s);
    return e ? {name:s,rect:rect('.hero-copy '+s),overflow:e.scrollWidth>e.clientWidth+2} : null;
  }).filter(Boolean);
  const marks = Array.from(document.querySelectorAll('svg.nav-icon')).map(e => {
    const r=e.getBoundingClientRect(), a=e.closest('a');
    return {width:r.width,height:r.height,path:e.querySelector('path')?.getAttribute('d'),hidden:e.getAttribute('aria-hidden'),href:a?.getAttribute('href'),origin:a?.origin,currentOrigin:location.origin,targetExists:a?.hash?!!document.getElementById(a.hash.slice(1)):false};
  }).filter(m=>m.width>0||m.height>0);
  const visible=e=>!!e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
  return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,
    brand:rect('.brand'),nav:rect('.site-header nav'),search:rect('.search-open'),header:rect('.site-header'),
    navLines:Array.from(document.querySelectorAll('.site-header nav>a')).map(e=>({height:e.getBoundingClientRect().height,lineHeight:getComputedStyle(e).lineHeight})),
    subjectLabelFonts:Array.from(document.querySelectorAll('.site-header nav>a,.subject-path-menu>summary')).map(e=>getComputedStyle(e).fontSize),
    readerControls:Array.from(document.querySelectorAll('.reader-controls > a,.reader-controls > details > summary')).filter(visible).map(e=>({tag:e.tagName,top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height})),
    hero,art:rect('.hero-art'),action:rect('.resume'),doors:rect('.subject-doors'),indexArt:rect('.index-art'),taskList:rect('.task-list'),marks};
}
export function layoutProblems(m) {
  const problems=[];const need=(ok,text)=>{if(!ok)problems.push(text)};
  const overlap=(a,b)=>a&&b&&Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
  need(!m.overflow,'document overflow');
  for(const [a,b] of [['brand','nav'],['nav','search'],['brand','search']])need(!overlap(m[a],m[b]),a+'/'+b+' overlap');
  if(m.search.y>=m.nav.bottom-.5){
    need(Math.abs(m.search.y-m.nav.bottom-12)<=1,'wrapped header row gap');
    need(Math.abs(m.search.x-m.nav.x)<=1&&Math.abs(m.search.right-(m.header.right-m.nav.x))<=1,'isolated search row width');
  }
  need(m.navLines.every(l=>l.height<=Number.parseFloat(l.lineHeight)+1),'wrapped subject name');
  need(new Set(m.subjectLabelFonts).size<=1,'subject label type mismatch');
  if(m.width<=680){const menus=m.readerControls.filter(e=>e.tag==='SUMMARY');if(menus.length>1)need(Math.max(...menus.map(e=>e.height))-Math.min(...menus.map(e=>e.height))<=1,'reader menu height mismatch');}
  if(m.art){
    need(!overlap(m.art,m.action),'art/action overlap');
    need(m.doors.y-m.art.bottom>=15,'art/subject-divider clearance');
    for(const block of m.hero){
      need(!block.overflow,'hero text escapes '+block.name);
      if(Math.min(block.rect.bottom,m.art.bottom)-Math.max(block.rect.y,m.art.y)>.5)need(m.art.x-block.rect.right>=23,'text/art clearance: '+block.name);
    }
  }
  if(m.indexArt&&m.taskList)need(m.taskList.y-m.indexArt.bottom>=15,'database illustration/task-divider clearance');
  for(const mark of m.marks){
    need(mark.width>=12&&mark.height>=12&&!!mark.path&&mark.hidden==='true','unrendered/inaccessible navigation mark');
  }
  return problems;
}
export async function runUiRegressions({page,setViewport,pressKey,readHistory=()=>page.evaluate(()=>({url:location.href,historyLength:history.length})),waitForPageEntry=async()=>{},baseURL,settle=async()=>{},onResult=()=>{}}) {
  const results=[],layouts=[];
  const require=(ok,text)=>{if(!ok)throw Error(text)};
  const ready=async()=>{await settle();};
  const go=async path=>{await page.goto(new URL('design/handbook-lab/'+path,baseURL).href);await waitForPageEntry();await ready();};
  const until=async(read,accept,label)=>{let value;for(let n=0;n<50;n++){value=await read();if(accept(value))return value;await new Promise(r=>setTimeout(r,40));}throw Error(label+': '+JSON.stringify(value));};
  const test=async(id,fn)=>{let row;try{row={id,status:'pass',observed:await fn()}}catch(e){row={id,status:'fail',finding:e.message}}results.push(row);await onResult(row);};
  await test('responsive-clearance-header-and-rendered-marks',async()=>{
    for(const path of ['index.html','operating-systems.html','databases.html','tasks/use.html','chapters/os-processes.html','chapters/mysql-installation.html']){
      await go(path);
      await until(()=>page.evaluate(()=>({fonts:document.fonts.status,images:Array.from(document.images).every(e=>e.complete&&e.naturalWidth>0)})),m=>m.fonts==='loaded'&&m.images,'assets not ready');
      for(const width of widths){await setViewport({width,height:900});await ready();const observed=await page.evaluate(measureLayout);const failures=layoutProblems(observed);require(Math.abs(observed.width-width)<=1,'viewport override did not apply');layouts.push({path,requestedWidth:width,width:observed.width,status:failures.length?'fail':'pass',failures,observed});}
    }
    const failed=layouts.filter(m=>m.status==='fail');require(!failed.length,JSON.stringify(failed.map(m=>({path:m.path,width:m.width,failures:m.failures}))));return {states:layouts.length};
  });
  await test('same-page-search-closes-and-focuses',async()=>{
    await setViewport({width:390,height:844});await go('chapters/os-processes.html');
    await page.getByRole('button',{name:'Search the handbook',exact:true}).press('Enter');await ready();
    await until(()=>page.evaluate(()=>({open:document.querySelector('.search-dialog').open,focus:document.activeElement.id})),m=>m.open&&m.focus==='handbook-query','search did not open at input');
    await page.getByRole('searchbox').fill('process');await ready();
    await page.getByRole('link',{name:/^Process control block/}).press('Enter');await ready();
    return until(()=>page.evaluate(()=>{const h=document.getElementById('os-processes--process-control-block-data-structure'),b=document.querySelector('.reader-controls');return {open:document.querySelector('.search-dialog').open,focus:document.activeElement.id,hash:location.hash,top:h.getBoundingClientRect().top,bar:b.getBoundingClientRect().bottom}}),m=>!m.open&&m.focus==='os-processes--process-control-block-data-structure'&&m.hash==='#'+m.focus&&m.top>=m.bar+8&&m.top<=m.bar+32,'same-page destination incomplete');
  });
  await test('escape-restores-visible-focus',async()=>{
    await go('chapters/os-processes.html');await page.getByRole('button',{name:'Search the handbook',exact:true}).press('Enter');await ready();
    await page.getByRole('searchbox').press('Escape');await ready();
    return until(()=>page.evaluate(()=>({open:document.querySelector('.search-dialog').open,focus:document.activeElement.className,outline:getComputedStyle(document.activeElement).outlineStyle})),m=>!m.open&&m.focus==='search-open'&&m.outline!=='none','Escape focus restoration failed');
  });
  await test('search-frame-stable-and-background-locked',async()=>{
    await go('chapters/os-processes.html');
    await page.getByRole('button',{name:'Search the handbook',exact:true}).press('Enter');await ready();
    await until(()=>page.evaluate(()=>({open:document.querySelector('.search-dialog').open,focus:document.activeElement.id})),m=>m.open&&m.focus==='handbook-query','search frame did not open at input');
    const measure=()=>page.evaluate(()=>{
      const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
      const results=document.querySelector('.search-results');
      return {dialog:rect('.search-dialog'),input:rect('#handbook-query'),close:rect('[data-search-close]'),y:scrollY,rootOverflow:getComputedStyle(document.documentElement).overflow,scrollTop:results.scrollTop,scrollRange:results.scrollHeight-results.clientHeight};
    });
    let lastFrame=null,stableFrame=0;
    const empty=await until(measure,m=>{const frame=JSON.stringify(m.dialog);stableFrame=frame===lastFrame?stableFrame+1:0;lastFrame=frame;return stableFrame>=3},'search entry did not settle');
    await page.getByRole('searchbox').fill('process');await ready();
    await until(()=>page.evaluate(()=>document.querySelectorAll('.search-results a').length),n=>n>0,'search results absent');
    const populated=await measure();
    await page.locator('.search-results a').first().press('PageDown');await ready();
    const scrolled=await until(measure,m=>m.scrollTop>0,'search result list did not scroll');
    for(const m of [populated,scrolled]){
      for(const key of ['dialog','input','close'])for(const part of ['x','y','width','height'])require(Math.abs(m[key][part]-empty[key][part])<=1,'search '+key+' '+part+' moved');
      require(m.rootOverflow==='hidden'&&Math.abs(m.y-empty.y)<=1,'modal background scroll unlocked');
    }
    await page.getByRole('button',{name:'Close search',exact:true}).click();await ready();
    require(await page.evaluate(()=>!document.querySelector('.search-dialog').open),'Close search did not close');
    return {empty,populated,scrolled};
  });
  await test('pointer-focus-and-keyboard-return',async()=>{
    await go('chapters/os-processes.html');
    await page.getByRole('button',{name:'Search the handbook',exact:true}).click();await ready();
    const pointer=await page.evaluate(()=>({id:document.activeElement.id,pointer:document.activeElement.hasAttribute('data-pointer-focus'),outline:getComputedStyle(document.activeElement).outlineStyle}));
    require(pointer.id==='handbook-query'&&pointer.pointer&&pointer.outline==='none','pointer search focus unexpectedly outlined');
    await page.getByRole('searchbox').press('Escape');await ready();
    const restored=await until(()=>page.evaluate(()=>({focus:document.activeElement.className,outline:getComputedStyle(document.activeElement).outlineStyle})),m=>m.focus==='search-open'&&m.outline!=='none','restored trigger focus invisible');
    return {pointer,restored};
  });
  await test('contents-choice-closes-and-focuses',async()=>{
    await go('chapters/os-processes.html');
    await page.locator('.contents-menu > summary').press('Enter');await ready();
    require(await page.evaluate(()=>document.querySelector('.contents-menu').open),'contents did not open');
    await page.locator('.contents-menu a[href="#os-processes--process-control-block-data-structure"]').press('Enter');await ready();
    return until(()=>page.evaluate(()=>({open:document.querySelector('.contents-menu').open,focus:document.activeElement.id,hash:location.hash})),m=>!m.open&&m.focus==='os-processes--process-control-block-data-structure'&&m.hash==='#'+m.focus,'contents choice did not complete');
  });
  await test('diagram-scroll-fit-and-escape',async()=>{
    await go('chapters/postgresql-joins.html');
    await page.getByRole('button',{name:'Enlarge diagram',exact:true}).first().press('Enter');await ready();
    const measure=()=>page.evaluate(()=>{
      const d=document.querySelector('.figure-dialog'),c=d.querySelector('.figure-canvas'),b=d.querySelector('[data-figure-close]'),r=b.getBoundingClientRect();
      return {open:d.open,close:{x:r.x,y:r.y,width:r.width,height:r.height},scrollLeft:c.scrollLeft,scrollRange:c.scrollWidth-c.clientWidth,fitted:c.classList.contains('fit-width'),y:scrollY,rootOverflow:getComputedStyle(document.documentElement).overflow};
    });
    // Native focus may finish a smooth scroll to the launch button. Establish
    // the settled modal position before testing subsequent canvas input.
    let lastY=null,stable=0;
    const initial=await until(measure,m=>{stable=lastY!==null&&Math.abs(m.y-lastY)<=.5?stable+1:0;lastY=m.y;return stable>=3},'diagram launch did not settle');
    require(initial.open&&initial.scrollRange>0,'diagram not open with local scrolling');
    await page.locator('.figure-canvas').press('ArrowRight');await ready();
    const scrolled=await until(measure,m=>m.scrollLeft>0,'diagram canvas did not scroll');
    await page.getByRole('button',{name:'Fit to width',exact:true}).click();await ready();
    const fitted=await until(measure,m=>m.fitted&&m.scrollRange<=1,'diagram did not fit');
    await page.getByRole('button',{name:'Actual size',exact:true}).click();await ready();
    const actual=await until(measure,m=>!m.fitted&&Math.abs(m.scrollRange-initial.scrollRange)<=1,'diagram did not restore actual size');
    for(const m of [scrolled,fitted,actual]){
      require(m.rootOverflow==='hidden'&&Math.abs(m.y-initial.y)<=1,'diagram background moved');
    }
    // The motion candidate reserves the viewer frame so fitting and scrolling
    // both leave the controls stationary.
    for(const m of [scrolled,fitted,actual]){
      for(const part of ['x','y','width','height'])require(Math.abs(m.close[part]-initial.close[part])<=1,'diagram Close control moved');
    }
    await page.getByRole('button',{name:'Close diagram',exact:true}).press('Escape');await ready();
    const closed=await until(()=>page.evaluate(()=>({open:document.querySelector('.figure-dialog').open,focus:document.activeElement.className})),m=>!m.open&&m.focus==='figure-enlarge','diagram Escape/focus restoration incomplete');
    return {initial,scrolled,fitted,actual,closed};
  });
  await test('responsive-single-contents-hierarchy',async()=>{
    const observations=[];
    for(const [path,count,product] of [['chapters/os-processes.html',12,null],['chapters/mysql-installation.html',19,'MySQL'],['chapters/postgresql-joins.html',12,'PostgreSQL'],['chapters/mongodb-upgrades.html',13,'MongoDB']]){
      for(const width of [390,768,1100,1101,1440]){
        await setViewport({width,height:900});await go(path);
        const m=await page.evaluate(()=>{
          const outer=document.querySelector('.reader-controls > .contents-menu'),aside=document.querySelector('.reading-aside'),reader=document.querySelector('.reader'),summary=outer.querySelector('summary'),current=outer.querySelector('[aria-current="page"]');
          const a=aside.getBoundingClientRect(),r=reader.getBoundingClientRect(),s=summary.getBoundingClientRect();
          return {width:innerWidth,open:outer.open,summaryVisible:s.width>0&&s.height>0,outerCount:document.querySelectorAll('.reader-controls > details').length,oldControls:document.querySelectorAll('.chapters-menu,.products-menu,.task-back,.reader-controls > a').length,chapters:Array.from(outer.querySelectorAll('.chapter-list > li > a')).map(e=>e.getAttribute('href')),currentCount:outer.querySelectorAll('[aria-current="page"]').length,currentGroupOpen:current.closest('.contents-group').open,sectionCount:current.parentElement.querySelectorAll('.chapter-sections a').length,sectionsValid:Array.from(current.parentElement.querySelectorAll('.chapter-sections a')).every(e=>e.hash&&!!document.getElementById(e.hash.slice(1))),bread:Array.from(document.querySelector('.breadcrumbs').children).map(e=>e.textContent.trim()),aside:{x:a.x,right:a.right,width:a.width},reader:{x:r.x,width:r.width},overflow:document.documentElement.scrollWidth>innerWidth};
        });
        require(m.outerCount===1&&m.oldControls===0,'duplicate navigation controls: '+path);
        require(m.chapters.length===count&&new Set(m.chapters).size===count&&m.currentCount===1&&m.currentGroupOpen&&m.sectionCount>0&&m.sectionsValid,'incomplete or misnested contents: '+path);
        require(m.bread.length===(product?3:2)&&(!product||m.bread[2]===product),'breadcrumb hierarchy: '+path);
        require(!m.overflow,'contents causes overflow');
        if(m.width>=1101)require(m.open&&!m.summaryVisible&&m.aside.right<=m.reader.x-24&&m.aside.width>=220,'wide reading rail placement');
        else {
          require(!m.open&&m.summaryVisible,'narrow Contents should start collapsed');
          await page.locator('.contents-menu > summary').press('Enter');await ready();
          const panel=await until(()=>page.evaluate(()=>{const r=document.querySelector('.contents-menu>nav').getBoundingClientRect();return {open:document.querySelector('.contents-menu').open,top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight}}),p=>p.open&&p.height>0&&p.top>=-1&&p.bottom<=p.viewport+1,'Contents panel exceeds available viewport: '+path+' at '+width);
          await page.locator('.contents-menu > summary').press('Escape');await ready();
          m.panel=panel;
        }
        observations.push({path,...m});
      }
    }return observations;
  });
  await test('contents-usable-from-bottom-and-chapter-choice',async()=>{
    await setViewport({width:390,height:844});await go('chapters/os-processes.html');
    await page.getByRole('link',{name:'Source 2',exact:true}).first().press('Enter');await ready();
    await until(()=>page.evaluate(()=>({y:scrollY,focus:document.activeElement.id,target:document.getElementById('os-processes--source-2').getBoundingClientRect().top,bar:document.querySelector('.reader-controls').getBoundingClientRect().bottom})),m=>m.y>1000&&m.focus==='os-processes--source-2'&&m.target>=m.bar+8&&m.target<=m.bar+32,'did not reach bottom citation');
    const position=await page.evaluate(()=>{const r=document.querySelector('.contents-menu > summary').getBoundingClientRect();return {y:r.y,bottom:r.bottom,height:innerHeight}});
    require(position.y>=0&&position.bottom<=position.height,'Contents is not visible from the reading position');
    await page.locator('.contents-menu > summary').press('Enter');await ready();
    await page.locator('.contents-menu > summary').press('Escape');await ready();
    const escaped=await page.evaluate(()=>({open:document.querySelector('.contents-menu').open,focused:document.activeElement===document.querySelector('.contents-menu > summary'),outline:getComputedStyle(document.activeElement).outlineStyle}));
    require(!escaped.open&&escaped.focused&&escaped.outline!=='none','Contents Escape did not restore visible focus');
    await page.locator('.contents-menu > summary').press('Enter');await ready();
    await page.getByRole('link',{name:'Memory and virtual memory',exact:true}).press('Enter');await ready();
    return until(()=>page.evaluate(()=>({chapter:document.body.dataset.chapter,current:document.querySelector('.contents-menu [aria-current="page"]').getAttribute('href'),open:document.querySelector('.contents-menu').open})),m=>m.chapter==='os-memory'&&m.current==='os-memory.html'&&!m.open,'chapter choice/current indication incomplete');
  });
  await test('continuation-before-sources-and-top-action',async()=>{
    const observations=[];
    for(const path of ['chapters/os-processes.html','chapters/mysql-installation.html','chapters/mongodb-upgrades.html']){
      await go(path);
      const m=await page.evaluate(()=>{const s=Array.from(document.querySelectorAll('.prose h2,.prose h3')).find(e=>e.textContent.trim()==='Sources'),n=document.querySelector('nav.adjacent'),a=document.querySelector('.site-footer button');return {sources:!!s,gap:s&&n?s.getBoundingClientRect().top-n.getBoundingClientRect().bottom:null,next:!!n?.querySelector('a[rel="next"]'),footerText:a.textContent.trim(),footerHref:a.getAttribute('href'),footerType:a.type,topTarget:!!document.getElementById('page-top'),internalDiagonal:Array.from(document.querySelectorAll('svg.nav-icon')).some(e=>e.querySelector('path')?.getAttribute('d')==='M3 13 13 3M4 3h9v9'&&e.closest('a')?.origin===location.origin)}});
      require(m.sources&&m.gap>=0&&m.next,'continuation follows Sources');require(m.footerText==='Back to top'&&m.footerHref===null&&m.footerType==='button'&&m.topTarget&&!m.internalDiagonal,'misleading navigation action');observations.push({path,...m});
    }
    return {observations};
  });
  await test('entry-links-omit-redundant-arrows',async()=>{
    const observations=[];
    for(const [path,selector,count] of [['databases.html','.task-list h2 a',8],['index.html','.resume,.subject-doors a',5]]){
      await go(path);
      const links=await page.evaluate(selector=>Array.from(document.querySelectorAll(selector)).map(e=>({text:e.textContent.trim(),href:e.getAttribute('href'),icons:e.querySelectorAll('svg').length,before:getComputedStyle(e,'::before').content,after:getComputedStyle(e,'::after').content})),selector);
      require(links.length===count&&links.every(e=>e.href&&e.text&&e.icons===0&&!/[→↗]/.test(e.text)&&['none','normal','""'].includes(e.before)&&['none','normal','""'].includes(e.after)),'unnecessary directional marks returned on entry links');
      observations.push({path,links});
    }
    await go('databases.html');
    await page.getByRole('link',{name:'Understand the moving parts',exact:true}).press('Enter');await waitForPageEntry();await ready();
    const next=await page.evaluate(()=>{const a=document.querySelector('.task-adjacent a[rel="next"]');return {path:location.pathname,label:a?.getAttribute('aria-label'),href:a?.getAttribute('href')}});
    require(next.path.endsWith('/tasks/understand.html')&&next.href==='store.html'&&next.label?.startsWith('Next task:'),'entry link or meaningful task progression was lost');
    return {observations,next};
  });
  await test('page-top-preserves-url-history-and-browser-back',async()=>{
    require(typeof page.goBack==='function'&&typeof page.goForward==='function','browser Back/Forward adapter required');
    await setViewport({width:390,height:844});await go('operating-systems.html');
    const previous=await page.evaluate(()=>location.href);
    await page.getByRole('link',{name:'Processes and scheduling',exact:true}).press('Enter');await waitForPageEntry();await ready();
    const top=page.getByRole('button',{name:'Back to top',exact:true});
    const bottom=async()=>{
      await top.press('Shift');await ready();let last=null,stable=0;
      return until(()=>page.evaluate(()=>{const r=document.querySelector('[data-page-top]').getBoundingClientRect();return {y:scrollY,buttonTop:r.top,buttonBottom:r.bottom,viewport:innerHeight}}),m=>{stable=last===m.y?stable+1:0;last=m.y;return stable>=3&&m.y>1000&&m.buttonTop>=0&&m.buttonBottom<=m.viewport},'footer did not reach its actual use position');
    };
    await bottom();
    const before=await readHistory();
    const activations=[];
    for(let n=0;n<2;n++){
      if(n)await bottom();
      await top.press('Enter');await ready();
      const reached=await until(()=>page.evaluate(()=>({y:scrollY,focus:document.activeElement.id,url:location.href})),m=>m.y>=0&&m.y<=2&&m.focus==='page-top','Back to top did not move position and focus');
      const after=await readHistory();require(reached.url===before.url&&after.url===before.url&&after.historyLength===before.historyLength,'viewport action changed URL or added browser history');activations.push({...reached,historyLength:after.historyLength});
    }
    await page.goBack();await waitForPageEntry();await ready();
    const back=await until(()=>page.evaluate(()=>location.href),url=>url===previous,'Back returned to an artificial bottom-of-page history stop');
    await page.goForward();await waitForPageEntry();await ready();
    const forward=await until(()=>page.evaluate(()=>({url:location.href,y:scrollY})),m=>m.url===before.url&&m.y>=0&&m.y<=2,'Forward did not return to the chapter at its last position');
    return {before,activations,back,forward};
  });
  await test('home-to-reader-without-directory-gates',async()=>{
    const observations=[];
    for(const width of [390,1440]){
      await setViewport({width,height:900});
      for(const [name,chapter] of [['Operating systems','os-processes'],['MySQL','mysql-overview'],['PostgreSQL','postgresql-foundations'],['MongoDB','mongodb-architecture']]){
        await go('index.html');const home=await page.evaluate(()=>location.href);
        if(name==='Operating systems')await page.locator('.subject-doors>a').press('Enter');
        else await page.locator('.product-entries').getByRole('link',{name,exact:true}).press('Enter');
        await waitForPageEntry();await ready();
        const reached=await page.evaluate(()=>{const c=document.querySelector('.contents-menu'),r=c.querySelector('summary').getBoundingClientRect();return {chapter:document.body.dataset.chapter,articleLength:document.querySelector('.prose')?.textContent.length,contentsCount:document.querySelectorAll('.contents-menu').length,wide:innerWidth>1100,contentsOpen:c.open,triggerVisible:r.width>0&&r.height>0,url:location.href,overflow:document.documentElement.scrollWidth>innerWidth}});
        require(reached.chapter===chapter&&reached.articleLength>100&&reached.contentsCount===1&&!reached.overflow,'Home entry stopped before actual readable content');
        require(reached.wide?reached.contentsOpen&&!reached.triggerVisible:!reached.contentsOpen&&reached.triggerVisible,'Contents unavailable after direct entry');
        await page.goBack();await waitForPageEntry();await ready();
        require(await page.evaluate(()=>location.href)===home,'Back added an intermediate directory stop');
        observations.push({width,name,reached});
      }
    }return observations;
  });
  await test('reader-path-switches-keep-the-task-and-avoid-indexes',async()=>{
    await setViewport({width:390,height:844});await go('chapters/mysql-installation.html');
    const observations=[];
    for(const [product,chapter] of [['PostgreSQL','postgresql-install-instances'],['MongoDB','mongodb-installation']]){
      await page.locator('.contents-menu>summary').press('Enter');await ready();
      await page.locator('.contents-product-links').getByRole('link',{name:product,exact:true}).press('Enter');await waitForPageEntry();await ready();
      const reached=await page.evaluate(()=>({chapter:document.body.dataset.chapter,product:document.querySelector('.contents-product-links strong')?.textContent,task:document.querySelector('.current-chapter').closest('.contents-group').querySelector('summary').textContent,url:location.href}));
      require(reached.chapter===chapter&&reached.product===product&&reached.task==='Get a server running','product switch lost the related task or stopped at a directory');observations.push(reached);
    }
    await page.locator('.contents-menu>summary').press('Enter');await ready();
    await page.locator('.contents-paths>.os-entry').press('Enter');await waitForPageEntry();await ready();
    require(await page.evaluate(()=>document.body.dataset.chapter)==='os-processes','subject switch did not reach OS content');
    await page.goBack();await waitForPageEntry();await ready();
    require(await page.evaluate(()=>document.body.dataset.chapter)==='mongodb-installation','subject switch added a directory history stop');
    return observations;
  });
  await test('database-chooser-is-an-accessible-history-neutral-disclosure',async()=>{
    await go('chapters/os-processes.html');
    const summary=page.locator('.subject-path-menu>summary');
    const read=()=>page.evaluate(()=>{const d=document.querySelector('.subject-path-menu'),s=d.querySelector('summary'),h=document.querySelector('.site-header').getBoundingClientRect(),p=d.querySelector('.subject-path-options').getBoundingClientRect();return {open:d.open,focused:document.activeElement===s,outline:getComputedStyle(s).outlineStyle,pointer:s.hasAttribute('data-pointer-focus'),header:{x:h.x,y:h.y,width:h.width,height:h.height},panel:{x:p.x,right:p.right},viewport:innerWidth,options:d.querySelectorAll('a').length}});
    const before=await read(),historyBefore=await readHistory();
    await summary.press('Enter');await ready();const opened=await until(read,m=>m.open,'database chooser did not open');
    require(opened.options===3&&opened.panel.x>=0&&opened.panel.right<=opened.viewport,'database choices exceed viewport');
    for(const part of ['x','y','width','height'])require(Math.abs(opened.header[part]-before.header[part])<=1,'opening database choices moved header controls');
    await summary.press('Escape');await ready();const escaped=await read();
    require(!escaped.open&&escaped.focused&&escaped.outline!=='none','database chooser Escape lost visible focus');
    await summary.click();await ready();const pointer=await read();require(pointer.open&&pointer.pointer&&pointer.outline==='none','pointer chooser retained keyboard outline');
    await page.getByRole('heading',{name:'Processes and scheduling',exact:true}).click();await ready();require(!(await read()).open,'outside activation left database chooser open');
    const historyAfter=await readHistory();require(historyAfter.url===historyBefore.url&&historyAfter.historyLength===historyBefore.historyLength,'opening a chooser changed navigation history');
    await summary.press('Enter');await ready();
    await page.locator('.subject-path-options').getByRole('link',{name:'PostgreSQL',exact:true}).press('Enter');await waitForPageEntry();await ready();
    require(await page.evaluate(()=>document.body.dataset.chapter)==='postgresql-foundations','header database choice did not reach content');
    return {before,opened,escaped,pointer,historyBefore,historyAfter};
  });
  await test('task-comparison-preserves-product-route',async()=>{
    await setViewport({width:390,height:844});await go('chapters/mysql-installation.html');
    await page.locator('.contents-menu > summary').press('Enter');await ready();
    await page.getByRole('link',{name:'Compare products for this task',exact:true}).press('Enter');await ready();
    require(await page.evaluate(()=>document.querySelector('h1').textContent==='Get a server running'),'comparison left the selected task');
    await page.getByRole('link',{name:'Installation, services and instances',exact:true}).press('Enter');await ready();
    return until(()=>page.evaluate(()=>({chapter:document.body.dataset.chapter,product:document.querySelector('.breadcrumbs>:last-child')?.textContent,task:document.querySelector('.current-chapter').closest('.contents-group').querySelector('summary').textContent})),m=>m.chapter==='postgresql-install-instances'&&m.product==='PostgreSQL'&&m.task==='Get a server running','task/product route lost context');
  });
  await test('contents-pointer-feedback-keeps-keyboard-return',async()=>{
    await go('chapters/mysql-installation.html');
    await page.locator('.contents-menu > summary').press('Enter');await ready();
    await page.locator('.contents-menu > summary').press('Escape');await ready();
    await page.locator('.contents-menu > summary').click();await ready();
    const pointer=await page.evaluate(()=>({open:document.querySelector('.contents-menu').open,outline:getComputedStyle(document.activeElement).outlineStyle,pointer:document.activeElement.hasAttribute('data-pointer-focus')}));
    require(pointer.open&&pointer.pointer&&pointer.outline==='none','pointer Contents retains incidental keyboard outline');
    await page.locator('.contents-menu > summary').press('Escape');await ready();
    const keyboard=await page.evaluate(()=>({open:document.querySelector('.contents-menu').open,focused:document.activeElement===document.querySelector('.contents-menu>summary'),outline:getComputedStyle(document.activeElement).outlineStyle}));
    require(!keyboard.open&&keyboard.focused&&keyboard.outline!=='none','Contents keyboard restoration lost focus indication');
    return {pointer,keyboard};
  });
  await test('copy-feedback-is-stable-repeatable-and-resets',async()=>{
    await go('chapters/mysql-installation.html');
    const button=page.locator('.copy-button').first();
    const read=()=>page.evaluate(()=>{const e=document.querySelector('.copy-button'),r=e.getBoundingClientRect();return {label:e.textContent,name:e.getAttribute('aria-label'),status:e.parentElement.querySelector('[role="status"]').textContent,state:e.dataset.copyState||null,width:r.width,height:r.height,outline:getComputedStyle(e).outlineStyle}});
    const initial=await read();require(initial.label==='Copy'&&initial.name==='Copy this code'&&initial.height>=44,'Copy label or target size');await button.press('Enter');await ready();
    const keyboard=await until(read,m=>m.state==='success'||m.state==='error','keyboard copy feedback absent');
    require(keyboard.outline!=='none','keyboard Copy focus invisible');
    await button.click();await ready();
    const feedback=await until(read,m=>m.state==='success'||m.state==='error','copy feedback absent');
    require(Math.abs(feedback.width-initial.width)<=1&&Math.abs(feedback.height-initial.height)<=1,'copy control changed size');
    require(feedback.outline==='none','pointer Copy retains keyboard outline');
    require(feedback.state==='success'?feedback.label==='Copied'&&feedback.status==='Copied':feedback.label==='Retry'&&feedback.status==='Could not copy'&&feedback.name.toLowerCase().includes('retry'),'Copy feedback is not readable or recoverable');
    await button.click();await ready();
    const repeated=await until(read,m=>m.state==='success'||m.state==='error','repeated copy feedback absent');
    const reset=await until(read,m=>m.label==='Copy'&&m.state===null,'copy feedback did not reset');
    require(Math.abs(reset.width-initial.width)<=1&&Math.abs(reset.height-initial.height)<=1,'reset copy control changed size');
    const index=await page.evaluate(()=>Array.from(document.querySelectorAll('.prose pre')).findIndex(e=>e.scrollWidth>e.clientWidth+120));
    require(index>=0,'wide-code fixture unavailable');
    const pre=page.locator('.prose pre').nth(index);
    const readScroll=()=>page.evaluate(index=>{const p=document.querySelectorAll('.prose pre')[index],b=p.parentElement.querySelector('.copy-button'),r=b.getBoundingClientRect(),f=p.parentElement.getBoundingClientRect();return {left:p.scrollLeft,button:{x:r.x-f.x,y:r.y-f.y,width:r.width,height:r.height},frame:{x:f.x,y:f.y},viewport:innerHeight,pageWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth}},index);
    await pre.press('ArrowRight');await ready();
    let prior=null,stable=0;
    const scrollStart=await until(readScroll,m=>{const frame=JSON.stringify(m);stable=frame===prior?stable+1:0;prior=frame;return stable>=3&&m.left>0&&m.frame.y+m.button.y>=0&&m.frame.y+m.button.y+m.button.height<=m.viewport},'wide-code focus/scroll did not settle');
    await pre.press('ArrowRight');await ready();
    const scrollEnd=await until(readScroll,m=>m.left>scrollStart.left+1,'wide code did not scroll');
    for(const part of ['x','y','width','height'])require(Math.abs(scrollEnd.button[part]-scrollStart.button[part])<=1,'Copy moved with horizontal code scroll');
    require(scrollEnd.pageWidth<=scrollEnd.viewportWidth,'wide code caused document overflow');
    return {initial,keyboard,feedback,repeated,reset,scrollStart,scrollEnd};
  });
  await test('modal-interrupts-travel-and-preserves-reading-position',async()=>{
    require(typeof pressKey==='function','native page-key adapter required for interruption check');
    await setViewport({width:390,height:844});await go('chapters/os-processes.html');
    await page.locator('.contents-menu>summary').press('Enter');await ready();
    await page.getByRole('link',{name:'Sources',exact:true}).press('Enter');await ready();
    await pressKey('Control+k');await ready();
    const start=await until(()=>page.evaluate(()=>({y:scrollY,open:document.querySelector('.search-dialog').open,focus:document.activeElement.id})),m=>m.open&&m.focus==='handbook-query','shortcut search did not open');
    await new Promise(resolve=>setTimeout(resolve,750));
    const settled=await page.evaluate(()=>({y:scrollY,open:document.querySelector('.search-dialog').open}));
    require(settled.open&&Math.abs(settled.y-start.y)<=1,'underlying travel continued behind modal');
    await pressKey('Escape');await ready();
    const closed=await until(()=>page.evaluate(()=>({y:scrollY,open:document.querySelector('.search-dialog').open,focus:document.activeElement.id})),m=>!m.open&&m.focus==='os-processes--section-1','shortcut search did not restore its origin');
    require(Math.abs(closed.y-start.y)<=1,'closing search resumed stale travel');
    return {start,settled,closed};
  });
  return {kind:'executed-browser-regressions',baseURL,results,layouts,status:results.some(r=>r.status==='fail')?'fail':'pass'};
}
