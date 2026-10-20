import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Package milestones belong in one changelog, not in cumulative README patches.
export function checkReleaseDocuments({version,changelog,readme}){
 assert.equal(typeof version,'string','package.json must declare a version');
 const entries=[...changelog.matchAll(/^##\s+\[([^\]]+)\]/gm)].map(match=>match[1]).filter(value=>/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/.test(value));
 assert.equal(entries[0],version,`CHANGELOG.md must start its versioned entries with package version ${version}`);
 assert.equal(new Set(entries).size,entries.length,'CHANGELOG.md contains duplicate version entries');
 assert(/\[[^\]]+\]\((?:\.\/)?CHANGELOG\.md(?:#[^)]+)?\)/i.test(readme),'README.md must link to CHANGELOG.md');
 assert(!/^#{2,3}\s+v?\[?\d+\.\d+\.\d+(?:\])?(?:\s|$)/m.test(readme),'README release-history headings belong in CHANGELOG.md');
 return version;
}

export async function verifyReleaseDocuments(root=path.dirname(path.dirname(fileURLToPath(import.meta.url)))){
 const [packageText,changelog,readme]=await Promise.all(['package.json','CHANGELOG.md','README.md'].map(name=>readFile(path.join(root,name),'utf8')));
 const version=checkReleaseDocuments({version:JSON.parse(packageText).version,changelog,readme});
 console.log(`Release documentation matches package version ${version}.`);
 return version;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await verifyReleaseDocuments();
