// Optional Linux/cloud adapter. Windows uses the documented in-app browser.
import {runUiRegressions} from '../tests/ui-regressions.mjs';
import {writeFile} from 'node:fs/promises';
if(process.platform==='win32')throw Error('Use the authorized side-browser adapter on Windows. This launcher is for a Linux cloud runner.');
const {chromium}=await import('playwright');
const baseURL=process.env.UI_BASE_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();page.setDefaultTimeout(10000);
  const waitForPageEntry=()=>page.evaluate(async()=>{
    await document.fonts.ready;
    await new Promise(resolve=>requestAnimationFrame(resolve));
    await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));
    await new Promise(resolve=>requestAnimationFrame(resolve));
  });
  const report=await runUiRegressions({slowRegistryBaseURL:process.env.UI_SLOW_REGISTRY_BASE_URL,page,waitForPageEntry,pressKey:key=>page.keyboard.press(key),wheel:async delta=>{const r=await page.locator('.reader').boundingBox();await page.mouse.move(r.x+r.width/2,400);await page.mouse.wheel(0,delta);},setViewport:size=>page.setViewportSize(size),baseURL,settle:()=>page.waitForLoadState('domcontentloaded'),onResult:r=>console.log(r.id+': '+r.status)});
  await writeFile(process.env.UI_REPORT||'/tmp/database-notes-browser-report.json',JSON.stringify(report,null,2)+'\n');
  process.exitCode=report.status==='pass'?0:1;
}finally{await browser.close();}
