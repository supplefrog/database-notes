// A disclosure remains open while closing so the content can actually animate.
// Every reversal starts at its current height; stale finishes cannot win.
export function installDisclosures(root=document) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'), states=new Map();
  for(const details of root.querySelectorAll('details.disclosure')) {
    const summary=details.querySelector('summary'), body=details.querySelector('.disclosure-body');
    const state={desired:details.open,animation:null,serial:0};states.set(details,state);
    function settle() {
      state.serial++;state.animation?.cancel();state.animation=null;
      details.open=state.desired;details.dataset.expanded=String(state.desired);
      body.style.height='';
    }
    function toggle(desired) {
      const from=details.open?body.getBoundingClientRect().height:0;
      state.desired=desired;state.serial++;const serial=state.serial;
      state.animation?.cancel();details.open=true;details.dataset.expanded=String(desired);
      body.style.height='auto';const to=desired?body.getBoundingClientRect().height:0;
      if(reduced.matches||typeof body.animate!=='function'){settle();return;}
      body.style.height=from+'px';
      state.animation=body.animate([{height:from+'px'},{height:to+'px'}],{duration:180,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'});
      state.animation.onfinish=()=>{if(serial===state.serial)settle();};
    }
    summary.addEventListener('click',event=>{event.preventDefault();if(details.dataset.unavailable!=='true')toggle(!state.desired);});
    details.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.desired){event.preventDefault();toggle(false);summary.focus();}});
    state.settle=settle;settle();
  }
  function settleAll(){for(const state of states.values())state.settle();}
  reduced.addEventListener('change',settleAll);addEventListener('resize',settleAll);
  return settleAll;
}
