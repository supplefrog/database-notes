// Real SQLite operations. No filesystem, network target, arbitrary SQL or credentials.
export const APP_ID=0x44424c42;
export const QUERY="SELECT id,severity,created_minute FROM incidents WHERE tenant_id=? AND state=? ORDER BY created_minute DESC,id DESC LIMIT 50";
export const INDEX="CREATE INDEX queue_lookup ON incidents(tenant_id,state,created_minute DESC,id DESC,severity)";
const SCHEMA=`CREATE TABLE tenants(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE);
CREATE TABLE incidents(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL REFERENCES tenants(id),state TEXT NOT NULL CHECK(state IN ('open','resolved')),severity INTEGER NOT NULL CHECK(severity BETWEEN 1 AND 4),created_minute INTEGER NOT NULL,version INTEGER NOT NULL CHECK(version>=1));`;
const columns={tenants:['id','name'],incidents:['id','tenant_id','state','severity','created_minute','version']};
const ids=[...Array.from({length:12},(_,i)=>7+i*24),...Array.from({length:12},(_,i)=>120001+i)];
const rows=(db,sql,params=[])=>{const s=db.prepare(sql);try{s.bind(params);const result=[];while(s.step())result.push(s.get());return result;}finally{s.free();}};
const scalar=(db,sql)=>rows(db,sql)[0][0];
const transaction=(db,fn)=>{db.run('BEGIN');try{fn();db.run('COMMIT');}catch(e){db.run('ROLLBACK');throw e;}};
async function hashRows(values){const content=values.map(r=>JSON.stringify(r)+'\n').join('');const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content));return {rows:values.length,sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')};}
export class RecoveryLab {
  constructor(SQL,oracle){this.SQL=SQL;this.oracle=structuredClone(oracle);this.live=null;this.recovered=null;this.checkpoint=null;this.stage='idle';this.audit=[];this.verdict=null;this.mode=null;}
  close(){this.live?.close();this.recovered?.close();this.checkpointDb?.close();this.live=null;this.recovered=null;this.checkpointDb=null;this.checkpoint=null;this.stage='idle';this.mode=null;this.verdict=null;this.audit=[];}
  require(condition,message){if(!condition)throw new Error(message);}
  open(bytes){const db=new this.SQL.Database(bytes);db.run('PRAGMA foreign_keys=ON');return db;}
  seed(){
    this.close();const db=this.open();this.live=db;
    db.run(`PRAGMA application_id=${APP_ID}`);db.run(SCHEMA);
    const tenants=db.prepare('INSERT INTO tenants VALUES (?,?)'), incidents=db.prepare('INSERT INTO incidents VALUES (?,?,?,?,?,?)');
    try{transaction(db,()=>{
      for(let i=1;i<=24;i++)tenants.run([i,'Tenant '+String(i).padStart(2,'0')]);
      for(let i=1;i<=120000;i++)incidents.run([i,(i-1)%24+1,i%5===0?'resolved':'open',i%4+1,i*37%100000,1]);
    });}finally{tenants.free();incidents.free();}
    db.run(INDEX);this.checkpoint=db.export();this.checkpointDb=this.open(this.checkpoint);db.run('PRAGMA foreign_keys=ON');
    this.audit.push({action:'Checkpoint',sql:'SQLite Database.export()',rows:120000,bytes:this.checkpoint.length});
    this.replay(db);
    this.audit.push({action:'Application writes',sql:'12 UPDATE + 12 INSERT, committed in one transaction',changes:24});
    this.stage='ready';return this.snapshot();
  }
  journal(){return Array.from({length:24},(_,i)=>i<12?{seq:i+1,sql:"UPDATE incidents SET state='resolved',version=version+1 WHERE id=? AND tenant_id=7",params:[7+i*24]}:{seq:i+1,sql:'INSERT INTO incidents VALUES (?,?,?,?,?,?)',params:[120001+i-12,7,'open',2,100013+i-12,1]});}
  replay(db){transaction(db,()=>{for(const op of this.journal()){db.run(op.sql,op.params);this.require(db.getRowsModified()===1,'Journal write did not affect exactly one row');}});}
  fault(){
    this.require(this.stage==='ready','Seed the lab before injecting its one bounded fault.');
    this.live.run('DELETE FROM incidents WHERE tenant_id=?',[7]);const changes=this.live.getRowsModified();
    this.require(changes===5012,'Unexpected fault boundary');
    this.stage='faulted';this.audit.push({action:'Tenant fault',sql:'DELETE FROM incidents WHERE tenant_id=?',params:[7],changes});return this.snapshot();
  }
  restore(mode){
    this.require(['faulted','restored','verified'].includes(this.stage),'Inject the tenant fault before restoring.');
    this.require(['checkpoint','journal'].includes(mode),'Choose a supported recovery method.');
    const next=this.open(this.checkpoint);
    try{if(mode==='journal')this.replay(next);}catch(e){next.close();throw e;}
    this.recovered?.close();this.recovered=next;this.mode=mode;this.verdict=null;this.stage='restored';
    this.audit.push({action:'Restore separate database',sql:'new SQLite.Database(checkpoint)'+(mode==='journal'?' + replay 24 application SQL writes':''),mode});return this.snapshot();
  }
  alter(){
    this.require(this.recovered&&this.mode==='journal','Restore with the journal before altering a recovered value.');
    this.require(scalar(this.recovered,'SELECT severity FROM incidents WHERE id=120001')===2,'The demonstration value has already changed.');
    this.recovered.run('UPDATE incidents SET severity=? WHERE id=?',[4,120001]);
    this.verdict=null;this.stage='restored';this.audit.push({action:'Same-count content fault',sql:'UPDATE incidents SET severity=? WHERE id=?',params:[4,120001],changes:this.recovered.getRowsModified()});return this.snapshot();
  }
  database(source){this.require(['live','recovered'].includes(source),'Unknown database copy.');const db=this[source];this.require(db,'That database copy is not available yet.');return db;}
  query(source,tenant){
    this.require(Number.isInteger(tenant)&&tenant>=1&&tenant<=24,'Tenant must be a whole number from 1 to 24.');
    const db=this.database(source),params=[tenant,'open'];
    return {source,sql:QUERY,params,columns:['id','severity','created_minute'],rows:rows(db,QUERY,params),plan:rows(db,'EXPLAIN QUERY PLAN '+QUERY,params)};
  }
  summary(db){if(!db)return null;return {incidents:scalar(db,'SELECT count(*) FROM incidents'),tenants:scalar(db,'SELECT count(*) FROM tenants'),tenant7:scalar(db,'SELECT count(*) FROM incidents WHERE tenant_id=7'),bands:rows(db,'SELECT tenant_id,count(*) FROM incidents GROUP BY tenant_id ORDER BY tenant_id')};}
  changed(){
    const db=this.recovered||this.live;if(!db)return [];
    const value=row=>row?{state:row[1],severity:row[2],version:row[3]}:null;
    return ids.map(id=>({id,checkpoint:value(rows(this.checkpointDb,'SELECT id,state,severity,version FROM incidents WHERE id=?',[id])[0]),actual:value(rows(db,'SELECT id,state,severity,version FROM incidents WHERE id=?',[id])[0])}));
  }
  snapshot(){return {stage:this.stage,mode:this.mode,engine:this.live?scalar(this.live,'SELECT sqlite_version()'):null,checkpoint:this.checkpoint?{...this.summary(this.checkpointDb),bytes:this.checkpoint.length}:null,live:this.summary(this.live),recovered:this.summary(this.recovered),changed:this.changed(),audit:structuredClone(this.audit),journal:this.journal(),verdict:this.verdict};}
  async verify(){
    this.require(this.recovered,'Restore a separate database before checking integrity.');const db=this.recovered;
    const actual={};for(const table of ['tenants','incidents'])actual[table]=await hashRows(rows(db,`SELECT * FROM ${table} ORDER BY id`));
    const marker=scalar(db,'PRAGMA application_id')===APP_ID;
    const integrity=rows(db,'PRAGMA integrity_check').map(r=>r[0]);
    const fkViolations=rows(db,'PRAGMA foreign_key_check');
    const schema=Object.fromEntries(Object.keys(columns).map(t=>[t,rows(db,`PRAGMA table_info(${t})`).map(r=>r[1])]));
    const tables=rows(db,"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map(r=>r[0]);
    const fkDefinition=rows(db,'PRAGMA foreign_key_list(incidents)');
    const checks={rowCounts:actual.tenants.rows===this.oracle.expected.tenants.rows&&actual.incidents.rows===this.oracle.expected.incidents.rows,
      orderedContent:actual.tenants.sha256===this.oracle.expected.tenants.sha256&&actual.incidents.sha256===this.oracle.expected.incidents.sha256,
      applicationMarker:marker,structure:JSON.stringify(integrity)==='["ok"]',foreignKeys:fkViolations.length===0&&fkDefinition.length===1&&fkDefinition[0][2]==='tenants'&&fkDefinition[0][3]==='tenant_id'&&fkDefinition[0][4]==='id',
      columns:JSON.stringify(schema)===JSON.stringify(columns),tables:JSON.stringify(tables)==='["incidents","tenants"]'};
    this.verdict={passed:Object.values(checks).every(Boolean),checks,expected:structuredClone(this.oracle.expected),actual,integrity,fkViolations,fkDefinition,schema,tables,oracle:this.oracle.generator,scope:this.oracle.serialization};
    this.stage='verified';this.audit.push({action:'Independent expected-state comparison',sql:'SELECT * FROM tenants ORDER BY id; SELECT * FROM incidents ORDER BY id; PRAGMA integrity_check; PRAGMA foreign_key_check;',passed:this.verdict.passed});return this.snapshot();
  }
}
