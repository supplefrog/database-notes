import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const supplied=process.argv[2];
if(!supplied)throw Error('Supply the HTTPS site base URL');
const base=new URL(supplied);
if(base.protocol!=='https:' || base.search || base.hash)throw Error('Supply an HTTPS site base URL without query or fragment');
if(!base.pathname.endsWith('/'))base.pathname+='/';
const manifest=JSON.parse(await readFile(new URL('../web-manifest.json',import.meta.url),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [file,hash] of Object.entries(manifest)){
 const response=await fetch(new URL(file,base),{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`${response.status} ${file}`);
 if(digest(Buffer.from(await response.arrayBuffer()))!==hash)throw Error(`Deployed content mismatch: ${file}`);
}
const entry=await fetch(base,{signal:AbortSignal.timeout(30000)});
if(!entry.ok || digest(Buffer.from(await entry.arrayBuffer()))!==manifest['index.html'])throw Error('Site root does not serve the portable entry page');
console.log(`Verified ${Object.keys(manifest).length} files byte-for-byte and the relative root entry at ${base.href}`);
