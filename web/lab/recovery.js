import {STAGES,QUERY,normalize,validRunId,event,verificationAgrees,benchmarkEqual,ratio,formatNumber as num,formatMs as ms} from './model.js';
import {recordingRequest,recordingId,publicationBase} from './public-reader.js';
const $=id=>document.getElementById(id);let state=null,lens='scan',busy=false,message='',errorMessage='';const seenRecovery=new Set();
const labels={seeded:'seeded',measured:'measured',protected:'protected',faulted:'faulted',recovered_unverified:'recovered',verified:'verified'};
const damagedStages=['faulted','recovered_unverified','verified','verification_failed'];
function el(tag, text, className) {const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(className)node.className=className;return node;}
function put(id,text){$(id).textContent=text;}
function timing(id,value){const n=ms(value);const node=$(id);node.replaceChildren(document.createTextNode(n??'—'));if(n!==null)node.append(el('span',' ms','unit'));}
function hashLine(label,hash){const p=el('p',undefined,'digest');p.append(el('span',label+' '),el('code',hash??'Unavailable'));return p;}
function render(){
  const stage=state?.stage||'entry', live=!!event(state,'checkpoint_and_writes'), damaged=damagedStages.includes(stage), b=state?.benchmark, cp=event(state,'checkpoint_and_writes'), fault=event(state,'delete_tenant_7'), recovery=event(state,'snapshot_restore_and_replay');
  const steps=$('stages');steps.replaceChildren();const pos=STAGES.indexOf(stage==='verification_failed'?'verified':stage);for(const [i,s] of STAGES.entries()){const li=el('li',s==='verified'&&stage==='verification_failed'?'check failed':labels[s]);if(i===pos){li.className='current';li.setAttribute('aria-current','step');}else if(i<pos)li.className='complete';steps.append(li);}
  put('headline', live?({protected:'Checkpoint saved. Changes journaled.',faulted:'Tenant 7 removed from the live copy.',recovered_unverified:'A new copy is ready for verification.',verified:'Application data matches the independent check.',verification_failed:'The recovered copy failed verification.'}[stage]):'Tenant 7’s 50 newest open incidents.');
  put('context', live?'The live database · recovery experiment':'Recorded synthetic data · real execution');
  $('context').hidden=!live;
  put('engine',state?.engine||'SQLite · local, isolated copies');put('seed-rows',num(state?.seed_rows||120000));put('query',b?.query||QUERY);
  const specimen=$('specimen');specimen.dataset.lens=lens;specimen.classList.toggle('live',live);specimen.classList.toggle('damaged',damaged);
  put('plate-source',live?'Live database · schematic':b?'Benchmark fixture · schematic':'Synthetic fixture · schematic');
  put('tenant-caption',damaged?'Tenant 7 removed · rust dashed outline':'Tenant 7 marked in marigold');
  put('field-caption',(live?'Live database schematic.':'Plan footprint schematic.')+' Band widths and texture do not represent row counts or work.');
  put('plate-note', damaged?`Tenant 7 removed · ${num(state?.after_fault?.incidents?.rows)} incidents remain`:live?`${num(cp.current_rows)} incidents after journaled changes`:b?(lens==='scan'?'Scan + temporary sort':'Covering-index search · tenant 7, open range'):state?'No recorded measurement':'Recording unavailable');
  $('lenses').disabled=!b||live||busy;$('lenses').querySelector('legend').textContent=live?'Benchmark copies retained':'View measurement copy';
  $('lenses').querySelector('.lens-options').hidden=live;
  put('lens-description',live?'Original timings and query plans remain below. This field now represents the live database.':!b?'Recorded query-plan evidence is unavailable.':lens==='scan'?'All bands illuminated: scan and temporary sort.':'Tenant 7’s open key range highlighted. Its area is schematic.');
  timing('scan-timing',b?.timings?.scan?.median_ms);timing('index-timing',b?.timings?.index?.median_ms);
  const method=b?.method;put('method-note',!b?'Not measured.':method?.warmups_per_variant===3&&method?.repeats_per_variant===9?'Warm cache · 9 alternating pairs after 3 warmups per variant.':'Recorded method available in the evidence.');
  put('equality',b?(benchmarkEqual(state)?`${num(b.result_count)} results each · Result hashes match`:'Result comparison unavailable; inspect evidence.'):'No result comparison yet.');const r=ratio(b);put('ratio',r!==null?`${r.toFixed(1)}× median ratio in this run`:'');
  $('benchmark-details').hidden=!b;if(b)renderBenchmark(b);
  put('status',message);$('error-panel').hidden=!errorMessage;put('error-message',errorMessage);
  $('recovery').hidden=!cp;if(cp)renderRecovery(cp,fault,recovery);
  put('run-label',state?`Run ${state.run_id}`:'No recording loaded');put('copy-note',fault?'Benchmark copies unchanged · damaged live copy retained':live?'Benchmark copies unchanged · checkpoint retained':'SQLite demonstration · application-journal recovery');
}
function renderBenchmark(b){const target=$('benchmark-evidence');target.replaceChildren();
  const grid=el('div',undefined,'details-grid');for(const key of ['scan','index']){const side=el('div');side.append(el('h3',key==='scan'?'Baseline plan':'Covering-index plan'));const lines=(b.plan?.[key]||[]).map(p=>p.detail);side.append(el('pre',lines.join('\n')||'Plan unavailable'));const t=b.timings?.[key];const p=el('p',undefined,'technical');p.textContent=t?`Min ${ms(t.min_ms)} · Median ${ms(t.median_ms)} · p95 ${ms(t.p95_ms)} · Max ${ms(t.max_ms)} ms`:'Timing summary unavailable';side.append(p);grid.append(side);}target.append(grid);
  target.append(el('pre',b.index_sql||'Index definition unavailable'));
  target.append(el('p',`Index build: ${ms(b.index_build_ms)??'Unavailable'} ms, outside query timing. Database file sizes: baseline ${num(b.baseline_bytes)} bytes; indexed ${num(b.indexed_bytes)} bytes.`,'technical'));
  const table=el('table');table.append(el('caption','Paired executions · milliseconds (fetching results included when confirmed by method)'));const head=el('thead'),hr=el('tr');for(const label of ['Pair','Baseline','Covering index'])hr.append(el('th',label));head.append(hr);table.append(head);const body=el('tbody'),a=b.timings?.scan?.samples_ms||[],z=b.timings?.index?.samples_ms||[];for(let i=0;i<Math.max(a.length,z.length);i++){const row=el('tr');for(const v of [String(i+1),ms(a[i])??'Unavailable',ms(z[i])??'Unavailable'])row.append(el('td',v));body.append(row);}table.append(body);target.append(table);
  target.append(hashLine('Shared SHA-256 of the compared ordered query results:',b.result_sha256));
  const m=b.method||{};target.append(el('p',`${num(m.warmups_per_variant)} warmups / ${num(m.repeats_per_variant)} repeats per variant. ${m.order||'Order unavailable'}. ${m.cache||'Cache method unavailable'}. Fetch all inside timing: ${m.fetch_all_in_timing===true?'yes':'unconfirmed'}. Clock: ${m.clock||'unavailable'}.`,'technical'));target.append(el('p',m.limits||'Method limitations unavailable.','technical'));
}
function register(label,count,description,className=''){const r=el('div',undefined,'register '+className);r.append(el('h3',label),el('div',undefined,'mini-field'));if(Number.isInteger(count))r.append(el('p',num(count),'count'),el('p','incidents'));r.append(el('p',description));return r;}
function proofSide(label,record){const side=el('div',undefined,'proof-side');side.append(el('h4',label));if(!record){side.append(el('p','Awaiting independent check.'));return side;}side.append(el('p',num(record.incidents?.rows),'big-count'),el('p','incidents'),el('p',`${num(record.tenants?.rows)} tenants`));return side;}
function renderRecovery(cp,fault,recovery){const registers=$('registers');registers.replaceChildren(register('Checkpoint',cp.snapshot_rows,'Frozen before the application changes.'));if(fault)registers.append(register('Damaged live copy',state.after_fault?.incidents?.rows,`${num(fault.removed_rows)} incident rows deleted. Preserved after recovery.`,'damaged'));else registers.append(register('Live copy',cp.current_rows,`${num(cp.journal_events)} application changes journaled: 12 updates and 12 inserts.`));
  if(recovery){const fresh=!seenRecovery.has(state.run_id);seenRecovery.add(state.run_id);registers.append(register('Recovered copy',state.verification?.actual?.incidents?.rows,`${num(recovery.replayed)} operations replayed · ${ms(recovery.recovery_ms)} ms. ${state.verification?'Independent check recorded below.':'Awaiting independent verification.'}`,'recovered'+(fresh?' fresh':'')));}
  const proof=$('proof');proof.hidden=!recovery;if(!recovery)return;const v=state.verification,passed=verificationAgrees(v),failed=state.stage==='verification_failed';proof.className='proof'+(passed?' verified':failed?' failed':'');
  put('proof-title',passed?'Independent content check passed.':failed?'Verification failed.':'Recovered is not yet verified.');put('proof-summary',v?v.oracle:'The new copy and the independently reconstructed expectation will be compared by a separate process.');
  const pair=$('proof-pair');pair.replaceChildren(proofSide('Recovered copy · actual',v?.actual));const seam=el('div',undefined,'seam');seam.append(el('span',passed?'Counts & content match':failed?'Check failed':'Not checked'));pair.append(seam,proofSide('Independent verifier · expected',v?.expected));
  const evidence=$('verification-evidence');evidence.replaceChildren();if(!v)return;
  const checks=el('ul',undefined,'check-list');for(const [label,ok] of [['Application marker',v.application_marker===true],['Column contract',v.column_contract===true],['SQLite integrity',Array.isArray(v.integrity_check)&&v.integrity_check.length===1&&v.integrity_check[0]==='ok'],['Foreign keys',Array.isArray(v.foreign_key_violations)&&v.foreign_key_violations.length===0]])checks.append(el('li',`${ok?'Pass':'Fail / unavailable'} · ${label}`,ok?'pass':'fail'));evidence.append(checks);
  const detail=el('details',undefined,'evidence-details');detail.append(el('summary','Inspect table digests & exact verifier response'));for(const name of ['incidents','tenants']){detail.append(el('h4',name),hashLine('Actual SHA-256:',v.actual?.[name]?.sha256),hashLine('Expected SHA-256:',v.expected?.[name]?.sha256));const a=v.actual?.[name],e=v.expected?.[name];detail.append(el('p',`Actual count ${num(a?.rows)} · Expected count ${num(e?.rows)} · ${a?.rows===e?.rows&&a?.sha256===e?.sha256?'count and digest match':'mismatch / unavailable'}`,'technical'));}detail.append(el('pre',JSON.stringify(v,null,2)));evidence.append(detail,el('p',`Scope: ${v.scope||'Unavailable'}`,'technical'),el('p',`Business tables only: ${v.business_tables_only===true?'yes':'unconfirmed'}. This is separate from the earlier benchmark result comparison.`,'technical'));
}

for(let i=1;i<=24;i++){const band=el('div',undefined,'band'+(i===7?' selected':''));band.append(el('span',undefined,'grain'),el('span',i,'number'));$('bands').append(band);}
let readSequence=0;
async function load(){
  const ticket=++readSequence;
  const hash=location.hash,params=new URLSearchParams(hash.slice(1)),id=params.get('run')||(!hash?recordingId:null);
  $('back-to-query').href=publicationBase+'/'+hash;
  try{
    if(!validRunId(id))throw new Error('A valid published recording identifier is required.');
    const response=await recordingRequest('/api/runs/'+id,{method:'GET'}),value=await response.json();
    if(ticket!==readSequence)return;
    if(!response.ok)throw new Error(value.error);
    state=normalize(value,id);errorMessage='';
    if(!hash)history.replaceState(null,'',location.pathname+'#run='+id);
    message=params.has('pending')?'Read-only recording. The inherited uncertainty marker is preserved; this capture cannot reconcile a live operation.':'Read-only recovery recording. No database operation runs on this website.';
    render();$('back-to-query').href=publicationBase+'/'+location.hash;
  }catch(error){if(ticket!==readSequence)return;state=null;errorMessage=error.message;message='Recorded evidence unavailable. No operation was attempted.';render();put('headline','Recording unavailable');}
}
$('resync').addEventListener('click',load);addEventListener('hashchange',load);
for(const link of document.querySelectorAll('a[href="#experiment"]'))link.addEventListener('click',event=>{event.preventDefault();$('experiment').focus({preventScroll:true});$('experiment').scrollIntoView({block:'start',behavior:'instant'});});
const narrow=matchMedia('(max-width:699px)');function queryDisclosure(){if(narrow.matches)$('query-details').removeAttribute('open');else $('query-details').setAttribute('open','');}queryDisclosure();narrow.addEventListener('change',queryDisclosure);
load();
