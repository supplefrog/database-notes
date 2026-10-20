const panel=document.querySelector('.section-panel');
const links=[...document.querySelectorAll('.section-links a')];
const base=document.querySelector('#label-paint'), glass=document.querySelector('#glass');
const enable=document.querySelector('#enable-glass'), reduce=document.querySelector('#reduce');
const thickness=document.querySelector('#thickness'), ior=document.querySelector('#ior');
const quality=document.querySelector('#quality'), samples=document.querySelector('#samples');
const message=document.querySelector('#render-status');
const motion=matchMedia('(prefers-reduced-motion:reduce)'), contrast=matchMedia('(forced-colors:active)');
let current=0, y=0, target=0, height=36, width=250, frame=0, last=0, velocity=0, textureScale=1;
let metrics=[], frames=0, firstInput=0, lastInputDelay=0, effective=false, shaderError='';
let gl, surface, final, bgTexture, targetTexture, fbo;
const pad=12;
const reduced=()=>motion.matches||reduce.checked;
const vertex=`#version 300 es
layout(location=0) in vec2 position; out vec2 uv;
void main(){uv=(position+1.)*.5;gl_Position=vec4(position,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;
in vec2 uv;out vec4 color;
uniform sampler2D background;
uniform vec2 viewSize,panelSize;
uniform float top,slabHeight,thickness,indexOfRefraction;
float sdf(vec2 p){vec2 q=abs(p)-vec2(panelSize.x*.5-4.,slabHeight*.5)+7.;return length(max(q,0.))+min(max(q.x,q.y),0.)-7.;}
float surfaceHeight(vec2 p){
 float d=sdf(p),b=clamp(-d/6.5,0.,1.);
 float bevel=sqrt(max(0.,1.-(1.-b)*(1.-b)));
 float crown=2.1*max(0.,1.-pow(p.y/(slabHeight*.5),2.));
 return thickness*bevel+crown*smoothstep(0.,3.,-d);
}
vec3 below(vec2 p){return texture(background,clamp(p/panelSize,vec2(0.),vec2(1.))).rgb;}
void main(){
 vec2 local=vec2(uv.x*viewSize.x,(1.-uv.y)*viewSize.y);
 vec2 p=local-vec2(viewSize.x*.5,viewSize.y*.5);
 vec2 global=vec2(local.x,top+local.y);
 float d=sdf(p),aa=max(fwidth(d),.035),coverage=1.-smoothstep(-aa,aa,d);
 float shadow=(1.-smoothstep(-1.,8.,sdf(p-vec2(0.,3.))))*.12;
 if(coverage<=0.){color=vec4(vec3(0.),shadow);return;}
 float h=surfaceHeight(p),e=.25;
 vec2 gradient=vec2(surfaceHeight(p+vec2(e,0.))-surfaceHeight(p-vec2(e,0.)),surfaceHeight(p+vec2(0.,e))-surfaceHeight(p-vec2(0.,e)))/(2.*e);
 vec3 normal=normalize(vec3(-gradient,1.));
 vec3 incident=normalize(vec3(p.x/900.,p.y/900.-.12,-1.));
 vec3 inside=refract(incident,normal,1./indexOfRefraction);
 vec3 outgoing=refract(inside,vec3(0.,0.,1.),indexOfRefraction);
 vec2 shift=(inside.xy/max(.08,-inside.z)-incident.xy/-incident.z)*h;
 if(length(outgoing)>.01)shift+=(outgoing.xy/max(.08,-outgoing.z)-incident.xy/-incident.z)*3.;
 shift=clamp(shift,vec2(-18.),vec2(18.));
 vec3 transmitted=below(global+shift);
 float f0=pow((indexOfRefraction-1.)/(indexOfRefraction+1.),2.);
 float fresnel=f0+(1.-f0)*pow(1.-max(0.,dot(-incident,normal)),5.);
 vec3 light=normalize(vec3(-.35,-.65,1.));
 vec3 halfway=normalize(light-incident);
 float spec=pow(max(0.,dot(normal,halfway)),70.);
 float rim=exp(-abs(d+1.1)*1.7);
 vec3 reflected=mix(vec3(.32,.31,.29),vec3(.98,.98,.96),smoothstep(-.15,.9,normal.y));
 vec3 material=mix(transmitted,reflected,fresnel*.65);
 material=mix(material,vec3(.96,.96,.94),.025)+vec3(spec*.16+rim*.05);
 color=vec4(material*coverage,coverage);
}`;
const tent=`#version 300 es
precision highp float;in vec2 uv;out vec4 color;
uniform sampler2D image;uniform vec2 texel;
void main(){vec4 c=vec4(0.);for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float w=float((x==0?2:1)*(y==0?2:1));c+=texture(image,uv+vec2(x,y)*texel)*w;}color=c/16.;}`;
function program(v,f){
 const make=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const p=gl.createProgram(),vs=make(gl.VERTEX_SHADER,v),fs=make(gl.FRAGMENT_SHADER,f);
 gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
}
function texture(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
try{
 gl=glass.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true,depth:false,stencil:false});
 if(!gl)throw Error('WebGL 2 unavailable');
 surface=program(vertex,fragment);final=program(vertex,tent);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 bgTexture=texture();targetTexture=texture();fbo=gl.createFramebuffer();
}catch(e){shaderError=String(e.message);enable.disabled=true;message.textContent='Standard marker retained: '+shaderError;}
glass.addEventListener('webglcontextlost',()=>{shaderError='WebGL context lost';enable.checked=false;enable.disabled=true;refresh();message.textContent='Standard marker retained: '+shaderError;});
function dimensions(){
 width=panel.clientWidth;height=links[current].getBoundingClientRect().height;
 const max=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),8192),dpr=devicePixelRatio||1;
 const outputScale=Math.min(+quality.value*dpr,max/Math.max(width,height+pad*2));
 glass.style.width=width+'px';glass.style.height=(height+pad*2)+'px';
 glass.width=Math.max(1,Math.round(width*outputScale));glass.height=Math.max(1,Math.round((height+pad*2)*outputScale));
 const sup=Math.min(+samples.value,max/glass.width,max/glass.height);
 const rw=Math.round(glass.width*sup),rh=Math.round(glass.height*sup);
 gl.bindTexture(gl.TEXTURE_2D,targetTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,rw,rh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
 gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,targetTexture,0);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Render target unavailable');
 glass.dataset.renderWidth=rw;glass.dataset.renderHeight=rh;
}
function labels(){
 if(!gl)return;
 const box=panel.getBoundingClientRect(),h=panel.scrollHeight;
 textureScale=Math.min(+quality.value*+samples.value*(devicePixelRatio||1),4096/Math.max(width,h));
 base.width=Math.round(width*textureScale);base.height=Math.round(h*textureScale);base.style.width=width+'px';base.style.height=h+'px';
 const c=base.getContext('2d');c.setTransform(textureScale,0,0,textureScale,0,0);c.fillStyle='#e9e9e5';c.fillRect(0,0,width,h);
 for(let i=0;i<links.length;i++){
  const a=links[i],r=a.getBoundingClientRect(),s=getComputedStyle(a),isCurrent=i===current;
  c.font=`${isCurrent?600:400} ${s.fontSize} ${s.fontFamily}`;
  const asc=c.measureText(a.textContent).fontBoundingBoxAscent||13,desc=c.measureText(a.textContent).fontBoundingBoxDescent||3;
  const line=parseFloat(s.lineHeight),left=r.left-box.left+parseFloat(s.paddingLeft),top=r.top-box.top+parseFloat(s.paddingTop);
  c.fillStyle=isCurrent?'#a4372b':'#5b5c56';
  c.fillText(a.textContent,left,top+(line-asc-desc)/2+asc);
  if(isCurrent){c.fillStyle='#a4372b';c.fillRect(0,r.top-box.top,2,r.height);}
 }
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,bgTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,base);
}
function render(){
 if(!effective)return;
 const h=height+pad*2,top=y-pad,rw=+glass.dataset.renderWidth,rh=+glass.dataset.renderHeight;
 glass.style.transform=`translateY(${top}px)`;
 gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,rw,rh);gl.useProgram(surface);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,bgTexture);
 const u=name=>gl.getUniformLocation(surface,name);
 gl.uniform1i(u('background'),0);gl.uniform2f(u('viewSize'),width,h);gl.uniform2f(u('panelSize'),width,panel.scrollHeight);
 gl.uniform1f(u('top'),top);gl.uniform1f(u('slabHeight'),height);gl.uniform1f(u('thickness'),+thickness.value);gl.uniform1f(u('indexOfRefraction'),+ior.value);
 gl.drawArrays(gl.TRIANGLES,0,6);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,glass.width,glass.height);gl.useProgram(final);
 gl.bindTexture(gl.TEXTURE_2D,targetTexture);gl.uniform1i(gl.getUniformLocation(final,'image'),0);gl.uniform2f(gl.getUniformLocation(final,'texel'),1/rw,1/rh);gl.drawArrays(gl.TRIANGLES,0,6);
 frames++;
 if(firstInput){lastInputDelay=performance.now()-firstInput;firstInput=0;}
}
function tick(time){
 frame=0;const dt=Math.min(.04,last?(time-last)/1000:1/60);if(last)metrics.push(time-last);last=time;
 if(reduced()){y=target;velocity=0;}else{
  const omega=25,x=y-target,k=velocity+omega*x,decay=Math.exp(-omega*dt);
  y=target+(x+k*dt)*decay;velocity=(velocity-omega*k*dt)*decay;
 }
 render();
 if(Math.abs(y-target)>.015||Math.abs(velocity)>.1)frame=requestAnimationFrame(tick);
 else{y=target;velocity=0;render();last=0;summary();}
}
function request(){if(!effective||document.hidden)return;if(!frame){last=0;metrics=[];frame=requestAnimationFrame(tick);}}
function summary(){
 if(!gl||shaderError)return;
 message.textContent=effective?`Glass enabled · ${glass.width}×${glass.height} output · ${glass.dataset.renderWidth}×${glass.dataset.renderHeight} render · Tent · MSAA/temporal off${reduced()?' · motion reduced':''}`:'Standard marker · glass experiment off';
}
function select(index){
 if(index===current)return;current=index;
 links.forEach((a,i)=>i===current?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current'));
 target=links[current].offsetTop;
 if(effective){height=links[current].getBoundingClientRect().height;dimensions();labels();request();}
}
function refresh(){
 effective=enable.checked&&!!gl&&!shaderError&&!contrast.matches;
 document.documentElement.classList.toggle('glass-on',effective);base.hidden=glass.hidden=!effective;
 if(frame){cancelAnimationFrame(frame);frame=0;}last=0;
 if(effective){try{target=links[current].offsetTop;y=target;velocity=0;dimensions();labels();render();}catch(e){shaderError=String(e.message);enable.checked=false;refresh();message.textContent='Standard marker retained: '+shaderError;}}
 summary();
}
let scrollFrame=0;
window.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{
 scrollFrame=0;const line=Math.min(innerHeight/3,120);let next=0;
 for(let i=0;i<links.length;i++){const t=document.getElementById(links[i].hash.slice(1));if(t.getBoundingClientRect().top>line)break;next=i;}
 if(scrollY>0&&scrollY+innerHeight>=document.documentElement.scrollHeight-2)next=links.length-1;
 select(next);
});},{passive:true});
for(const a of links)a.addEventListener('click',event=>{
 if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();history.replaceState(history.state,'',a.hash);
 const t=document.getElementById(a.hash.slice(1));t.tabIndex=-1;t.focus({preventScroll:true});t.scrollIntoView({behavior:'instant',block:'start'});
 select(links.indexOf(a));
});
document.addEventListener('click',event=>{
 const a=event.target.closest('a');
 if(!a||event.defaultPrevented||event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||a.origin!==location.origin||a.pathname!==location.pathname||!a.hash)return;
 const t=document.getElementById(decodeURIComponent(a.hash.slice(1)));if(!t)return;
 event.preventDefault();history.replaceState(history.state,'',a.hash);t.tabIndex=-1;t.focus({preventScroll:true});t.scrollIntoView({behavior:'instant',block:'start'});
});
for(const c of [thickness,ior])c.addEventListener('input',()=>{document.querySelector('#'+c.id+'-value').value=c.value;firstInput=performance.now();request();});
for(const c of [quality,samples])c.addEventListener('input',()=>{document.querySelector('#'+c.id+'-value').value=c.value;firstInput=performance.now();refresh();});
enable.checked=new URL(location.href).searchParams.get('glass')==='1';
enable.addEventListener('change',()=>{const u=new URL(location.href);u.searchParams.set('glass',enable.checked?'1':'0');history.replaceState(history.state,'',u);refresh();});
document.querySelector('#reset').addEventListener('click',()=>{
 enable.checked=false;reduce.checked=false;
 for(const [control,value] of [[thickness,'9'],[ior,'1.48'],[quality,'3'],[samples,'2']]){control.value=value;document.querySelector('#'+control.id+'-value').value=value;}
 const u=new URL(location.href);u.searchParams.set('glass','0');history.replaceState(history.state,'',u);refresh();
});
reduce.addEventListener('change',()=>{if(reduced()){y=target;velocity=0;}request();summary();});
motion.addEventListener('change',()=>{if(reduced()){y=target;velocity=0;}request();summary();});contrast.addEventListener('change',refresh);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;}else refresh();});
new ResizeObserver(refresh).observe(panel);
document.fonts.ready.then(refresh);refresh();
Object.defineProperty(window,'glassLabState',{get:()=>({enabled:effective,current:links[current].textContent,y,target,velocity,reduced:reduced(),frames,inputToDrawCallbackMs:lastInputDelay,activeRafIntervalsMs:[...metrics],output:[glass.width,glass.height],render:[+glass.dataset.renderWidth,+glass.dataset.renderHeight],textureScale,shaderError,limits:'Screen-space height-field transmission, not a full-scene path tracer. rAF/input timings are callbacks, not physical presentation or GPU timings.'})});
