import {revealStep} from './contents-glass-entry.mjs';

// The browser refracts its live backdrop. No duplicated article/text snapshot.
export function attachPageTopGlass(button,{signal}){
 const ns='http://www.w3.org/2000/svg',create=(name,attrs)=>{const el=document.createElementNS(ns,name);for(const [key,value]of Object.entries(attrs||{}))el.setAttribute(key,value);return el;};
 const svg=create('svg',{'aria-hidden':'true',width:0,height:0});svg.classList.add('page-top-optics');
 const defs=create('defs'),filter=create('filter',{id:'page-top-refraction',x:0,y:0,width:'100%',height:'100%','color-interpolation-filters':'sRGB'});
 const map=create('feImage',{result:'normals',preserveAspectRatio:'none',x:0,y:0,width:'100%',height:'100%'});
 const lens=create('feDisplacementMap',{in:'SourceGraphic',in2:'normals',scale:24,xChannelSelector:'R',yChannelSelector:'G'});
 filter.append(map,lens);defs.append(filter);svg.append(defs);document.body.append(svg);
 const label=document.createElement('span');label.className='page-top-label';label.textContent=button.textContent;button.replaceChildren(label);
 button.setAttribute('data-glass','');
 let state={value:0,velocity:0},target=0,frame=0,last=0;
 const motion=matchMedia('(prefers-reduced-motion:reduce)');
 const paint=()=>{const p=Math.max(0,Math.min(1.06,state.value));button.style.setProperty('--top-presence',Math.min(1,p));button.style.setProperty('--top-x',.58+.42*p);button.style.setProperty('--top-y',.24+.76*p);button.toggleAttribute('data-painted',p>.002);};
 function tick(time){frame=0;state=revealStep(state,target,last?(time-last)/1000:1/60,motion.matches);last=time;
  if(Math.abs(state.value-target)<.001&&Math.abs(state.velocity)<.01){state={value:target,velocity:0};last=0;}else frame=requestAnimationFrame(tick);paint();
 }
 const setVisible=visible=>{target=visible?1:0;if(motion.matches){cancelAnimationFrame(frame);frame=0;state={value:target,velocity:0};last=0;paint();}else if(!frame){last=0;frame=requestAnimationFrame(tick);}};
 function optics(){
  const w=Math.ceil(button.offsetWidth),h=Math.ceil(button.offsetHeight),scale=2,canvas=document.createElement('canvas');canvas.width=w*scale;canvas.height=h*scale;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(canvas.width,canvas.height),radius=h/2;
  const height=(x,y)=>{const qx=Math.abs(x)-(w/2-radius),qy=Math.abs(y),d=Math.hypot(Math.max(qx,0),qy)-radius;const b=Math.max(0,Math.min(1,-d/8));return 7*Math.sqrt(Math.max(0,1-(1-b)**2));};
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
   const px=(x+.5)/scale-w/2,py=(y+.5)/scale-h/2,e=.35;
   const gx=(height(px+e,py)-height(px-e,py))/(2*e),gy=(height(px,py+e)-height(px,py-e))/(2*e),n=Math.hypot(gx,gy,1);
   const sx=-px*.035-gx/n*6,sy=-py*.035-gy/n*6,i=(y*canvas.width+x)*4;
   image.data[i]=Math.round(255*(.5+sx/24));image.data[i+1]=Math.round(255*(.5+sy/24));image.data[i+2]=128;image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);map.setAttribute('href',canvas.toDataURL());
 }
 const size=new ResizeObserver(optics);size.observe(button);optics();paint();
 motion.addEventListener('change',()=>setVisible(!!target),{signal});
 signal.addEventListener('abort',()=>{cancelAnimationFrame(frame);size.disconnect();svg.remove();},{once:true});
 return {setVisible};
}
