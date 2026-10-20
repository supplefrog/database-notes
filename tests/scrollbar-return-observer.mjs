// Private observation only. It never scrolls, focuses or alters product state.
const output=document.createElement('script');output.id='scrollbar-return-qc';output.type='application/json';document.body.append(output);
const traces=[];let active=false,pending;
function state(){
 const top=document.querySelector('[data-page-top]'),aside=document.querySelector('.reading-aside'),nav=document.querySelector('.contents-menu>nav');
 const code=[...document.querySelectorAll('.prose pre')].find(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&el.scrollWidth>el.clientWidth;});
 const bar=el=>{if(!el)return null;const s=getComputedStyle(el),r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,clientWidth:el.clientWidth,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight,scrollLeft:el.scrollLeft,scrollTop:el.scrollTop,track:Number(s.getPropertyValue('--notes-track-reveal')),pill:Number(s.getPropertyValue('--notes-pill-reveal')),thumb:s.getPropertyValue('--notes-thumb'),lane:getComputedStyle(el,'::-webkit-scrollbar').width};};
 return {y:scrollY,max:Math.max(0,document.documentElement.scrollHeight-innerHeight),height:innerHeight,width:innerWidth,history:history.length,url:location.href,focus:document.activeElement?.id,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,top:top?{visible:top.hasAttribute('data-visible'),presence:Number(top.style.getPropertyValue('--top-presence')),scaleY:Number(top.style.getPropertyValue('--top-y')),inert:top.hasAttribute('inert')}:null,aside:bar(aside),nav:bar(nav),code:bar(code)};
}
function capture(event){
 if(active){pending=event.type;return;}active=true;output.dataset.running='true';const trace={event:event.type,frames:[]},start=performance.now();traces.push(trace);if(traces.length>12)traces.shift();
 function tick(time){trace.frames.push({ms:time-start,...state()});if(time-start<700)requestAnimationFrame(tick);else{output.textContent=JSON.stringify(traces);output.dataset.running='false';active=false;if(pending){const type=pending;pending=null;capture({type});}}}requestAnimationFrame(tick);
}
for(const type of ['pointerdown','pointerover','pointerout','keydown','focusin','scroll'])document.addEventListener(type,capture,{capture:true,passive:true});
for(const type of ['scroll','resize'])window.addEventListener(type,capture,{passive:true});
capture({type:'initial'});
