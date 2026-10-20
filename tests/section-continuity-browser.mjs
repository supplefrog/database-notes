import {exitIssues,historyIssues} from './section-continuity-checks.mjs';
export async function runSectionPolish({page,setViewport,capture,clickContents,back,forward,baseURL}){
 const results=[],assert=(ok,message)=>{if(!ok)throw Error(message);};
 const inspect=()=>page.evaluate(()=>({route:document.body.dataset.chapter,y:scrollY,focus:document.activeElement?.id,focusTag:document.activeElement?.tagName,url:document.URL,menu:document.querySelector('.contents-menu').open,closing:document.querySelector('.contents-menu').hasAttribute('data-closing'),canvases:document.querySelectorAll('.contents-glass-layer canvas').length,top:document.querySelector('[data-page-top]').hasAttribute('data-visible'),inert:document.querySelector('[data-page-top]').hasAttribute('inert'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
 const save=(id,batches,extra={})=>results.push({id,status:'pass',...extra,batches});
 for(const width of [684,390]){
  await setViewport({width,height:668});
  await page.goto(new URL('chapters/mysql-replication.html?qc=disclosure',baseURL).href);
  await page.locator('#contents-disclosure-qc[data-running="false"]').waitFor({state:'attached'});
  assert(!(await inspect()).top,'Back to top appears before reading travel');
  await capture(clickContents);
  const heading=await capture(()=>page.locator('.chapter-sections a[href="#mysql-replication--section-3"]').click());
  const issues=[...exitIssues(heading).issues,...historyIssues(heading)];assert(!issues.length,issues.join('; '));
  let state=await inspect();assert(state.focus==='mysql-replication--section-3'&&!state.menu&&!state.closing&&!state.overflow,'Heading/focus/exit state is wrong');
  assert(state.top&&!state.inert,'Later Back to top is unavailable');
  const forming=heading.flatMap(b=>b.frames).filter(f=>f.topAction?.presence>.01&&f.topAction.presence<.98);
  assert(forming.length>=3,'No intermediate bubbly Back-to-top entrance');
  assert(heading.flatMap(b=>b.frames).some(f=>f.topAction?.scaleY>1.005),'No restrained entrance overshoot');
  save(`heading-exit-and-return-entrance-${width}`,heading,{exit:exitIssues(heading),formingFrames:forming.length});
  const beforeURL=state.url,top=await capture(()=>page.locator('[data-page-top]').click());state=await inspect();
  assert(!historyIssues(top).length&&state.url===beforeURL&&state.y<1&&state.focus==='page-top'&&!state.top&&state.inert,'Back to top changes history, misses focus/top or remains active');
  save(`glass-return-history-focus-${width}`,top);
  await capture(clickContents);
  const chapter=await capture(()=>page.locator('.chapter-list a[href="mysql-group-replication.html"]').click());
  const frames=chapter.flatMap(b=>b.frames),origins=new Set(frames.map(f=>f.documentTimeOrigin));state=await inspect();
  assert(origins.size===1&&new Set(frames.map(f=>f.route)).size===2,'Chapter change replaced the document or missed intermediate route evidence');
  assert(chapter[0].historyStart.length+1===chapter.at(-1).historyEnd.length,'Chapter navigation did not create exactly one entry');
  assert(state.route==='mysql-group-replication'&&state.focusTag==='H1'&&state.y<1&&state.canvases===1&&!state.overflow,'New chapter mount/focus/geometry is wrong');
  save(`chapter-same-document-${width}`,chapter);
  const expectedPreviousY=chapter[0].frames[0].pageY;
  const previous=await capture(back);state=await inspect();assert(state.route==='mysql-replication'&&Math.abs(state.y-expectedPreviousY)<1,'Back did not restore the prior chapter/position');save(`chapter-back-${width}`,previous,{expectedPreviousY});
  const next=await capture(forward);state=await inspect();assert(state.route==='mysql-group-replication'&&state.y<1,'Forward did not restore the chapter');save(`chapter-forward-${width}`,next);
 }
 return {status:'pass',results,scope:'Actual in-app browser journeys and intermediate sampled state; not external Chrome or physical presentation FPS'};
}
