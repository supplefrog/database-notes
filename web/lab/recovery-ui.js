import {createLabClient} from './recovery-client.mjs';
import {QUERY} from './recovery-engine.mjs';
import {showRecordedHeader} from './recorded-header.mjs';
const $=id=>document.getElementById(id),num=value=>value.toLocaleString('en-US');
const text=(id,value)=>{$(id).textContent=value;};
const node=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
const client=createLabClient(()=>new Worker(new URL('./recovery-worker.js',import.meta.url)));
let snapshot=null,busy=false,progressVisible=false,generation=0,started=false;
const stageNames={idle:'Not started',ready:'Ready for fault',faulted:'Tenant 7 deleted',restored:'Awaiting verification',verified:'Verification complete'};
function href(view){const p=new URLSearchParams(location.hash.slice(1));view==='recovery'?p.set('view','recovery'):p.delete('view');return location.pathname+location.search+(p.size?'#'+p:'');}
function activeView(){return new URLSearchParams(location.hash.slice(1)).get('view')==='recovery'?'recovery':'recorded';}
function view(){
  const current=activeView();document.body.dataset.view=current;$('recorded-view').hidden=current!=='recorded';$('recovery-view').hidden=current!=='recovery';
  for(const v of ['recorded','recovery']){const a=$(v+'-view-link');a.href=href(v);if(v===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  document.title=current==='recovery'?'DB Lab — Recovery exercise':'DB Lab — Recorded query inspection';
  if(current==='recovery'){text('engine',snapshot?'SQLite '+snapshot.engine+' / browser memory':'Browser SQLite / recovery exercise');text('stage',progressVisible?'Running SQL':snapshot?.verdict?(snapshot.verdict.passed?'Integrity verified':'Verification failed'):stageNames[snapshot?.stage||'idle']);$('stage').dataset.confirmed=String(!!snapshot?.verdict?.passed);$('stage').dataset.failed=String(!!snapshot?.verdict&&!snapshot.verdict.passed);}
  else showRecordedHeader();
}
document.addEventListener('click',e=>{const a=e.target.closest?.('a');if(!a||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;if(a.matches('[data-lab-view],#recovery,#slate,#original')){const next=a.id==='original'||a.dataset.labView==='recorded'?'recorded':'recovery';e.preventDefault();history.pushState(null,'',href(next));view();$('main').focus({preventScroll:true});$('main').scrollIntoView({block:'start',behavior:'instant'});}});
window.addEventListener('hashchange',view);window.addEventListener('popstate',view);
function controls(){
  const s=snapshot?.stage,ready=!!snapshot;
  $('lab-start').hidden=ready;$('lab-start').disabled=busy;$('lab-reset').disabled=!started&&!busy;
  $('lab-fault').disabled=busy||s!=='ready';$('lab-restore').disabled=busy||!['faulted','restored','verified'].includes(s);
  $('lab-verify').disabled=busy||!snapshot?.recovered;$('lab-query').disabled=busy||!ready;
  $('lab-alter').disabled=busy||snapshot?.mode!=='journal'||!snapshot?.changed.find(r=>r.id===120001&&r.actual?.severity===2);
  $('query-recovered').disabled=busy||!snapshot?.recovered;
  for(const input of $('recovery-view').querySelectorAll('input'))if(input.id!=='query-recovered')input.disabled=busy;
  $('recovery-view').setAttribute('aria-busy',String(busy));view();
}
function paintBands(id,summary,{stale=false}={}){
  const root=$(id);root.dataset.present=String(!!summary);root.dataset.stale=String(stale);
  const bands=summary?.bands||[];
  for(let i=0;i<24;i++){const band=root.children[i],count=summary?bands.find(r=>r[0]===i+1)?.[1]||0:0;band.dataset.missing=String(!!summary&&count===0);band.title='Tenant '+(i+1)+': '+(summary?num(count)+' incidents':'not created');}
  root.setAttribute('aria-label',summary?`${id.startsWith('live')?'Live':id.startsWith('checkpoint')?'Checkpoint':'Recovered'} database: ${num(summary.incidents)} incidents; tenant 7 has ${num(summary.tenant7)}.${stale?' Checkpoint state is stale.':''}`:'Database copy not created.');
}
function render(){
  const s=snapshot;
  text('checkpoint-count',s?num(s.checkpoint.incidents)+' incidents':'Not created');
  text('live-count',s?num(s.live.incidents)+' incidents · tenant 7: '+num(s.live.tenant7):'Not created');
  text('recovered-count',s?.recovered?num(s.recovered.incidents)+' incidents · '+(s.mode==='journal'?'journal replayed':'checkpoint only'):'Awaiting restore');
  paintBands('checkpoint-bands',s?.checkpoint);paintBands('live-bands',s?.live);paintBands('recovered-bands',s?.recovered,{stale:s?.mode==='checkpoint'});
  if(s)text('lab-runtime','SQLite '+s.engine+' · sql.js 1.15.1');
  const v=s?.verdict;$('lab-verdict').dataset.verdict=v?(v.passed?'pass':'fail'):'pending';
  text('verdict-title',v?(v.passed?'PASS — every recovered business row matches':'FAIL — recovered data does not match'):'Recovery is not verified');
  text('verdict-copy',v?(v.passed?'Counts, ordered content and structural checks match the independent expected state. The damaged live copy remains unchanged.':v.checks.rowCounts?'Row counts match, but ordered content differs. A count alone would have missed this change.':'Checkpoint data is structurally valid, but the 24 later writes are missing. Restore with the application journal and verify again.'):'A successful restore does not establish that the right data came back.');
  const names={rowCounts:'Row counts',orderedContent:'Ordered content SHA-256',applicationMarker:'Application marker',structure:'SQLite structure',foreignKeys:'Foreign keys',columns:'Columns',tables:'Business tables'};
  $('verification-checks').replaceChildren(...(v?Object.entries(v.checks).map(([k,ok])=>{const li=node('li',(ok?'PASS · ':'FAIL · ')+names[k]);li.dataset.pass=String(ok);return li;}):[]));
  text('lab-full-verification',v?JSON.stringify(v,null,2):'No verification executed.');
  text('lab-audit',s?JSON.stringify(s.audit,null,2):'No actions executed.');text('lab-journal',s?JSON.stringify(s.journal,null,2):'Start the lab to inspect its 24 committed writes.');
  text('changed-working',s?.recovered?'Recovered':'Live');text('changed-copy',s?.recovered?'Actual recovered values beside the checkpoint. Missing inserts and version changes expose a stale restore.':s?'Actual live values beside the saved checkpoint. The fault removes all 24 of these tenant-7 records.':'Compare checkpoint values with the working copy after starting.');
  const value=v=>v?`${v.state} · ${v.severity} · v${v.version}`:'Absent';
  $('changed-rows').replaceChildren(...(s?.changed||[]).map(r=>{const tr=node('tr');tr.append(node('th',String(r.id)),node('td',value(r.checkpoint)),node('td',value(r.actual)));tr.firstChild.scope='row';if(JSON.stringify(r.checkpoint)!==JSON.stringify(r.actual))tr.dataset.changed='true';return tr;}));
  controls();
}
function renderQuery(result){
  text('live-query-sql',result.sql+'\nParameters: '+JSON.stringify(result.params));text('query-readout',`${result.source==='live'?'Live':'Recovered'} · tenant ${result.params[0]} · ${result.rows.length} open incidents returned`);text('query-caption',`${result.rows.length} actual SQLite rows / newest first`);
  $('live-query-rows').replaceChildren(...result.rows.map(r=>{const tr=node('tr');tr.append(...r.map(x=>node('td',String(x))));return tr;}));text('live-query-plan',JSON.stringify(result.plan,null,2));
}
async function query(){const tenant=Number($('query-tenant').value);const source=document.querySelector('input[name="query-copy"]:checked').value;renderQuery(await client.request('query',{source,tenant}));}
const messages={start:'Loading SQLite and seeding 120,000 incidents, then applying 24 writes…',fault:'Executing the tenant-7 delete…',restore:'Restoring a separate database…',verify:'Checking all ordered rows, hashes and database structure…',alter:'Updating one recovered severity…',query:'Executing SELECT and EXPLAIN QUERY PLAN…'};
function settled(){const s=snapshot;if(!s)return 'Start to create the database and checkpoint in browser memory.';if(s.verdict)return s.verdict.passed?'Verified: 120,012 recovered incidents match the independent expected state.':'Verification failed. Inspect counts and ordered content below.';if(s.stage==='ready')return 'Ready: checkpoint saved; 24 application writes committed. Delete tenant 7 to begin recovery.';if(s.stage==='faulted')return 'Deleted 5,012 incidents from live. Choose a recovery method for a separate copy.';return 'Recovered copy created. Verify it before accepting the outcome.';}
async function run(action,args={}){
  if(busy)return;const ticket=generation;busy=true;progressVisible=false;if(action==='start')started=true;$('lab-error').hidden=true;controls();
  // Fast SQL commands retain stable text; perceptible waits get honest feedback.
  const progress=setTimeout(()=>{if(ticket===generation&&busy){progressVisible=true;text('lab-status',messages[action]);view();}},150);
  try{
    if(action==='query')await query();
    else{
      const result=await client.request(action,args);if(ticket!==generation)return;snapshot=result;render();
      if(['start','restore','fault','alter'].includes(action)){
        if(action==='restore')$('query-recovered').checked=true;
        if(action==='start')document.querySelector('input[name="query-copy"][value="live"]').checked=true;
        await query();
      }
    }
    if(ticket===generation)text('lab-status',settled());
  }catch(e){if(ticket!==generation||e.name==='AbortError')return;text('lab-error',e.message+' Reset the lab if the engine could not load.');$('lab-error').hidden=false;text('lab-status',snapshot?'Last completed database state remains visible.':'SQLite did not start. Reset or retry.');}
  finally{clearTimeout(progress);if(ticket===generation){busy=false;progressVisible=false;controls();}}
}
$('lab-start').addEventListener('click',()=>run('start'));
$('lab-fault').addEventListener('click',()=>run('fault'));
$('lab-restore').addEventListener('click',()=>run('restore',{mode:document.querySelector('input[name="recovery-method"]:checked').value}));
$('lab-verify').addEventListener('click',()=>run('verify'));
$('lab-alter').addEventListener('click',()=>run('alter'));
$('lab-query-form').addEventListener('submit',e=>{e.preventDefault();if($('lab-query-form').reportValidity())run('query');});
function resetLab({focus=true}={}){generation++;client.reset();snapshot=null;started=false;busy=false;progressVisible=false;$('lab-error').hidden=true;text('lab-status','Reset complete. Start to rebuild the same deterministic fixture.');text('live-query-sql',QUERY);text('live-query-plan','Not executed.');text('query-readout','Start the lab to run the first query.');text('query-caption','No SQL results yet');text('lab-runtime','sql.js 1.15.1 / WebAssembly');$('live-query-rows').replaceChildren();$('query-tenant').value='7';document.querySelector('input[name="query-copy"][value="live"]').checked=true;document.querySelector('input[name="recovery-method"][value="checkpoint"]').checked=true;render();if(focus)$('lab-start').focus();}
$('lab-reset').addEventListener('click',()=>resetLab());
for(const id of ['checkpoint-bands','live-bands','recovered-bands'])for(let i=1;i<=24;i++){const band=node('div');band.className='band';band.setAttribute('aria-hidden','true');band.dataset.tenant=String(i);$(id).append(band);}
for(let i=1;i<=24;i++)$('recovery-axis').append(node('span',String(i)));
text('live-query-sql',QUERY);render();view();
fetch(new URL('./recording.json',import.meta.url)).then(r=>{if(!r.ok)throw Error();return r.json();}).then(r=>text('lab-recorded-recovery',JSON.stringify({run_id:r.run_id,engine:r.engine,stage:r.stage,events:r.events,before_fault:r.before_fault,after_fault:r.after_fault,verification:r.verification},null,2))).catch(()=>text('lab-recorded-recovery','Recording could not be read. Use the complete JSON link to retry.'));
window.addEventListener('pagehide',()=>{generation++;client.reset();});
window.addEventListener('pageshow',e=>{if(e.persisted)resetLab({focus:false});});
