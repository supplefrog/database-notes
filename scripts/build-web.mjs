import {verifyReleaseDocuments} from './check-release.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
await verifyReleaseDocuments(root);
const web=path.join(root,'web');
const manifest=JSON.parse(await readFile(path.join(root,'web-manifest.json'),'utf8'));
async function inventory(directory,prefix=''){
 const files=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  assert(!entry.isSymbolicLink(),`Symbolic link is not publication content: ${prefix+entry.name}`);
  if(entry.isDirectory())files.push(...await inventory(path.join(directory,entry.name),prefix+entry.name+'/'));
  else {assert(entry.isFile(),`Unexpected file type: ${prefix+entry.name}`);files.push(prefix+entry.name);}
 }
 return files;
}
assert.deepEqual((await inventory(web)).sort(),Object.keys(manifest).sort(),'Publication inventory differs from approved manifest');
for(const [name,expected] of Object.entries(manifest)){
 assert(!path.isAbsolute(name) && !name.includes('\\') && !name.split('/').includes('..'),`Invalid manifest path: ${name}`);
 const bytes=await readFile(path.join(web,name));
 const actual=createHash('sha256').update(bytes).digest('hex');
 assert.equal(actual,expected,`Publication content differs: ${name}`);
}
const config=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
assert.equal(config.framework,null,'Static site must use Other, not Next.js');
assert.equal(config.outputDirectory,'web','Only approved public files may be served');
assert.equal(config.installCommand,'','Dependency installation must remain disabled');
const entry=await readFile(path.join(web,'index.html'),'utf8');
assert(entry.includes('url=./design/handbook-lab/index.html') && entry.includes('href=\"./design/handbook-lab/index.html\"'),'Root entry must retain relative refresh and link fallback');
console.log(`Validated ${Object.keys(manifest).length} approved static files. Vercel output directory: web; framework: Other.`);
