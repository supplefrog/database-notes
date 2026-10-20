// Native link/history semantics, enhanced only between authored reader pages.
// No fetched scripts run. Failed or unsupported enhancement uses the real URL.
export function installReaderNavigation({remount}){
 if(!window.navigation||!document.body.dataset.chapter)return;
 const directory=new URL('./',location.href),positions=new Map();
 let renderedPath=location.pathname,transition;
 const chapterURL=url=>url.origin===location.origin&&url.pathname.startsWith(directory.pathname)&&/^[a-z0-9-]+\.html$/.test(url.pathname.slice(directory.pathname.length));
 navigation.addEventListener('navigate',event=>{
  const url=new URL(event.destination.url);
  if(!event.canIntercept||event.downloadRequest!==null||event.formData||event.hashChange||!chapterURL(url)||url.pathname===renderedPath)return;
  positions.set(navigation.currentEntry.key,{x:scrollX,y:scrollY});
  const restore=event.navigationType==='traverse'?positions.get(event.destination.key):null;
  event.intercept({focusReset:'manual',scroll:'manual',async handler(){
   const outgoing=document.querySelector('#main-content');outgoing.setAttribute('aria-busy','true');
   try{
    const response=await fetch(url,{signal:event.signal});
    if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('Chapter unavailable');
    const parsed=new DOMParser().parseFromString(await response.text(),'text/html'),incoming=parsed.querySelector('#main-content');
    if(!incoming||!parsed.body.dataset.chapter||!incoming.querySelector('.reader')||parsed.querySelector('base'))throw Error('Unsupported chapter');
    if(event.signal.aborted)return;
    transition?.skipTransition();
    const commit=()=>{
     if(event.signal.aborted)return;
     remount(()=>{
      outgoing.replaceWith(incoming);document.title=parsed.title;
      document.body.dataset.chapter=parsed.body.dataset.chapter;document.body.dataset.root=parsed.body.dataset.root;
      renderedPath=url.pathname;
     });
     let target;try{target=url.hash&&document.getElementById(decodeURIComponent(url.hash.slice(1)));}catch{}
     target ||= incoming.querySelector('h1')||incoming;
     if(!target.hasAttribute('tabindex'))target.tabIndex=-1;
     target.focus({preventScroll:true});
     if(restore)scrollTo({left:restore.x,top:restore.y,behavior:'instant'});
     else if(url.hash)target.scrollIntoView({block:'start',behavior:'instant'});
     else scrollTo({top:0,left:0,behavior:'instant'});
     document.dispatchEvent(new Event('reader:change'));
    };
    if(document.startViewTransition&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
     const currentTransition=document.startViewTransition(commit);transition=currentTransition;
     event.signal.addEventListener('abort',()=>currentTransition.skipTransition(),{once:true});
     await currentTransition.updateCallbackDone;
    }else commit();
   }catch(error){if(!event.signal.aborted){outgoing.removeAttribute('aria-busy');location.reload();}}
  }});
 });
}
