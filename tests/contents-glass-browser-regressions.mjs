import {contentsMotionProblems} from './contents-glass-motion-checks.mjs';

// Fresh browser journeys. capture(action) must observe the actual reader while
// executing action, and return its new frame batches; recorded JSON is not an
// acceptable adapter. Native wheel and the visible Contents trigger are required.
export async function runContentsMotionRegressions({page,setViewport,wheel,clickContents,capture,baseURL}){
  if(!wheel||!clickContents||!capture)throw Error('Actual input and fresh frame adapters required');
  const results=[];
  const require=(condition,message)=>{if(!condition)throw Error(message);};
  const inspect=()=>page.evaluate(()=>({open:document.querySelector('.contents-menu')?.open,current:document.querySelector('.chapter-sections a[aria-current]')?.hash,focus:document.activeElement?.id,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  const run=async(id,action,{travel=false,manual=false,exit=false,target=null,focus=true}={})=>{
    const batches=await capture(action),frames=batches.flatMap(b=>b.frames),issues=batches.flatMap(contentsMotionProblems);
    require(!issues.length,`${id}: ${[...new Set(issues)].join('; ')}`);
    require(frames.filter(f=>f.ready&&f.shape).length>3,`${id}: no rendered observation`);
    const moved=frames.some((f,i,a)=>i&&f.shape&&a[i-1].shape&&Math.abs(f.shape.y-a[i-1].shape.y)>.1);
    if(travel)require(moved,`${id}: no intermediate glass movement`);
    if(manual)require(moved&&frames.some(f=>f.owner?.kind==='scroll'),`${id}: native manual takeover not observed`);
    const exiting=frames.filter(f=>!f.open&&f.opacity>0);
    if(exit)require(exiting.length>=2,`${id}: visible exit was not observed`);
    const final=await inspect();require(final.overflow<=0,`${id}: document overflow`);
    if(target)require(final.current===target&&(!focus||final.focus===target.slice(1)),`${id}: wrong reading/focus destination`);
    results.push({id,status:'pass',frames:frames.length,visibleExitFrames:exiting.length,moved,final,batches});
  };
  const fixture=async width=>{
    await setViewport({width,height:900});
    await page.goto(new URL('chapters/os-kernel-devices.html?qc=contents-motion',baseURL).href);
    await page.locator('#contents-motion-qc[data-running="false"]').waitFor({state:'attached',timeoutMs:5000});
  };
  const link=hash=>page.locator(`.chapter-sections a[href="${hash}"]`);
  const first='#os-kernel-devices--device-management',kernel='#os-kernel-devices--kernel-modules',pam='#os-kernel-devices--pluggable-authentication-modules-pam';
  await fixture(1440);
  await run('wide-short-topic-arrival',()=>link(kernel).click(),{travel:true,target:kernel});
  await run('wide-wrapped-topic-and-rapid-reversal',async()=>{await link(pam).click();await link(first).click();},{travel:true,target:first});
  await run('wide-keyboard-arrival',()=>link(kernel).press('Enter'),{travel:true,target:kernel});
  await run('plain-scroll-forward',()=>wheel(120),{manual:true});
  await run('plain-scroll-reverse',()=>wheel(-120),{manual:true});
  await fixture(390);
  await run('narrow-open-first-paint',()=>clickContents());
  await run('narrow-section-exit-freezes-matched-paint',()=>link(kernel).click(),{exit:true,target:kernel});
  await run('narrow-reopen-prepares-matched-first-paint',()=>clickContents(),{target:kernel,focus:false});
  return {status:'pass',scope:'Fresh actual reader input and intermediate frames; not physical FPS or optical pixel certification',results};
}
