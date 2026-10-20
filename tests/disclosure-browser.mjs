import {geometryIssues,entranceIssues,entranceEvidence} from './disclosure-checks.mjs';
export async function runDisclosureRegressions({page,setViewport,capture,clickContents,burstGroup,burstContents,baseURL}){
 const results=[],group=()=>page.locator('.contents-group').filter({hasText:'Store data and handle change'}).locator('summary');
 const run=async(id,action,{entrance=false,threshold=false,reversals=false,interruption=false}={})=>{
  const batches=await capture(action),frames=batches.flatMap(b=>b.frames),issues=geometryIssues(batches);
  if(entrance)issues.push(...entranceIssues(batches));
  const port=frames[0].width>1100?'aside':'nav',overflowStates=[...new Set(frames.map(f=>f[port].scroll>f[port].room+1))];
  if(threshold&&overflowStates.length<2)issues.push('Did not cross actual scrollbar overflow threshold');
  const flips=frames.slice(1).filter((f,i)=>f.groups[1].open!==frames[i].groups[1].open).length;
  if(reversals&&flips<2)issues.push('Rapid reversal did not expose intermediate open/closed states');
  if(interruption&&!frames.some(f=>f.glass?.reveal?.value>.08&&f.glass.reveal.value<.9&&(!f.menu.open||!f.groups[1].open)))issues.push('Entry interruption did not witness an actually forming bubble');
  results.push({id,status:issues.length?'fail':'pass',issues,overflowStates,flips,entrance:entrance?entranceEvidence(batches):null,batches});
 };
 const fixture=async width=>{await setViewport({width,height:900});await page.goto(new URL('chapters/mysql-innodb.html?qc=disclosure',baseURL).href);await page.locator('#contents-disclosure-qc[data-running="false"]').waitFor({state:'attached',timeoutMs:5000});};
 await fixture(1440);
 await run('wide-close-crosses-overflow-without-shift',()=>group().click(),{threshold:true});
 await run('wide-open-crosses-overflow-and-forms-bubble',()=>group().click(),{threshold:true,entrance:true});
 await run('wide-disclosure-rapid-reversal',async()=>{await group().click();await group().press('Enter');await group().press('Enter');await group().press('Enter');},{reversals:true});
 await run('wide-close-before-entry-interruption',()=>group().click());
 await run('wide-bubble-entry-is-interruption-safe',burstGroup,{interruption:true});
 await fixture(390);
 await run('narrow-menu-opens-with-bubble',clickContents,{entrance:true});
 await run('narrow-group-closes-without-width-shift',()=>group().click());
 await run('narrow-group-opens-with-bubble',()=>group().click(),{entrance:true});
 await run('narrow-group-keyboard-reversal',async()=>{await group().press('Enter');await group().press('Enter');await group().press('Enter');await group().press('Enter');},{reversals:true});
 await run('narrow-menu-reversal-retains-live-material',async()=>{await clickContents();await clickContents();});
 await run('narrow-close-before-entry-interruption',clickContents);
 await run('narrow-bubble-entry-is-interruption-safe',burstContents,{interruption:true});
 return {status:results.some(r=>r.status==='fail')?'fail':'pass',scope:'Actual IAB input and sampled intermediate DOM/drawn-material state; not physical FPS or optical pixel certification',results};
}
