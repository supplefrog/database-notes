// Pure presentation boundary. Values remain server evidence, not client telemetry.
export const STAGES = ['seeded', 'measured', 'protected', 'faulted', 'recovered_unverified', 'verified'];
export const QUERY = "SELECT id, severity, created_minute FROM incidents\nWHERE tenant_id = ? AND state = ?\nORDER BY created_minute DESC, id DESC LIMIT 50";
export const ACTIONS = {
  entry: ['Start experiment', 'One fixture. A measurable change. A recoverable fault.', 'Create task-owned SQLite copies from a deterministic seed. No connection details or external database targets are accepted.', 'Creating experiment…'],
  seeded: ['Measure query', 'What does the covering index change?', 'Run the same query against separate baseline and indexed copies. Compare fetched results and repeated warm-cache timings.', 'Measuring query…'],
  measured: ['Create checkpoint + apply changes', 'Protect the live database before the fault.', 'Save the live database, then apply 12 updates and 12 inserts. Both effects belong to this one operation.', 'Creating checkpoint and applying changes…'],
  protected: ['Delete tenant 7 from live copy', 'Remove tenant 7 from this run’s live copy.', 'This controlled deletion targets only this experiment. The checkpoint and benchmark copies are retained.', 'Deleting tenant 7 from live copy…'],
  faulted: ['Restore into a new database', 'Recover beside the damaged live copy.', 'Restore the checkpoint and replay the application journal into a separate recovered database. The damaged live copy is preserved.', 'Restoring and replaying…'],
  recovered_unverified: ['Verify recovered copy', 'Recovery is ready. Is the content right?', 'A separate process reconstructs the expected business data from the fixture specification, then checks counts, ordered content, structure and foreign keys.', 'Checking recovery…'],
  verified: ['Run verification again', 'Application data matches the independent check.', 'Inspect the counts, full content digests and verification scope below. The live copy remains damaged.', 'Checking recovery…'],
  verification_failed: ['Run verification again', 'The recovered copy failed verification.', 'Inspect the reported checks below. The recovered copy, damaged live database and evidence are preserved.', 'Checking recovery…'],
};
export const OPERATION = {seeded:'measure', measured:'checkpoint', protected:'fault', faulted:'recover', recovered_unverified:'verify', verified:'verify', verification_failed:'verify'};
export function validRunId(value) { return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value); }
export function normalize(value, expectedId) {
  if (!value || !validRunId(value.run_id) || (expectedId && value.run_id !== expectedId) || !ACTIONS[value.stage] || !Array.isArray(value.events) || !Number.isInteger(value.seed_rows) || typeof value.engine !== 'string') throw new Error('The server returned an unsupported experiment state. Read authoritative status before continuing.');
  if (value.stage === 'verified' && !verificationAgrees(value.verification)) throw new Error('The server labelled this verified, but complete matching verification evidence is missing.');
  return value;
}
export function event(state, action) { return state?.events?.findLast(e => e.action === action); }
export function verificationAgrees(v) {
  return v?.passed === true && v.application_marker === true && v.column_contract === true && v.business_tables_only === true && Array.isArray(v.integrity_check) && v.integrity_check.length === 1 && v.integrity_check[0] === 'ok' && Array.isArray(v.foreign_key_violations) && v.foreign_key_violations.length === 0 && ['incidents','tenants'].every(table => {
    const a=v.actual?.[table], e=v.expected?.[table];
    return Number.isInteger(a?.rows) && a.rows === e?.rows && typeof a.sha256 === 'string' && /^[0-9a-f]{64}$/.test(a.sha256) && a.sha256 === e.sha256;
  });
}
export function benchmarkEqual(state) { return event(state, 'query_measurement')?.results_equal === true && Number.isInteger(state?.benchmark?.result_count) && /^[0-9a-f]{64}$/.test(state?.benchmark?.result_sha256 || ''); }
export function ratio(benchmark) { const a=benchmark?.timings?.scan?.median_ms, b=benchmark?.timings?.index?.median_ms;return Number.isFinite(a)&&a>=0&&Number.isFinite(b)&&b>0 ? a/b : null; }
export function advanced(state, pending) { return state.run_id === pending.run_id && (state.stage !== pending.stage || (pending.action === 'verify' && state.events.filter(e=>e.action==='independent_verification').length > pending.verifications)); }
export function actionBody(state) { const action=OPERATION[state.stage];if(!action)throw new Error('No operation is available.');return action === 'measure' ? {action,tenant:7} : action === 'fault' ? {action,confirmation:state.run_id} : {action}; }
export function formatNumber(n) { return Number.isFinite(n) ? n.toLocaleString('en-US') : 'Unavailable'; }
export function formatMs(n) { return Number.isFinite(n) && n>=0 ? n.toFixed(4) : null; }
