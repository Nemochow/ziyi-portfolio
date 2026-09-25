(() => {
 const deck=document.querySelector('#deck'),status=document.querySelector('#status'),cancel=document.querySelector('#cancel'),label=deck.querySelector('.label');
 const sources=[...document.querySelectorAll('.sleeve')];let selected=0;
 function select(i){selected=(i+sources.length)%sources.length;document.querySelector('#retro-track').textContent='CASE 0'+(selected+1)+' / 03';document.querySelector('#retro-title').textContent=sources[selected].dataset.name.toUpperCase();sources.forEach((s,n)=>s.closest('.album').classList.toggle('is-selected',n===selected));}
 let timer,drag,busy=false;
 const reset=()=>{clearTimeout(timer);busy=false;deck.classList.remove('playing','target');cancel.hidden=true;status.textContent='Three projects. Different ways of thinking.';document.querySelector('#retro-state').textContent='READY';};
 function play(source){if(busy)return;select(sources.indexOf(source));busy=true;if(matchMedia('(prefers-reduced-motion: reduce)').matches){location.href=source.dataset.href;return;}deck.classList.add('playing');status.textContent='Opening '+source.dataset.name;document.querySelector('#retro-state').textContent='OPENING';cancel.hidden=false;timer=setTimeout(()=>location.href=source.dataset.href,1300);}
 function clean(){drag?.ghost?.remove();drag=null;deck.classList.remove('target');}
 const inside=e=>{const r=deck.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;};
 document.querySelectorAll('.sleeve').forEach(source=>{
  let suppress=false;
  source.addEventListener('pointerdown',e=>{if(busy||e.button!==0||e.pointerType==='touch')return;drag={source,x:e.clientX,y:e.clientY};source.setPointerCapture(e.pointerId);});
  source.addEventListener('pointermove',e=>{if(!drag||drag.source!==source)return;if(!drag.ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8){drag.ghost=source.querySelector('.disc').cloneNode(true);drag.ghost.className='disc drag-ghost';drag.ghost.setAttribute('aria-hidden','true');document.body.append(drag.ghost);}if(drag.ghost){drag.ghost.style.left=(e.clientX-80)+'px';drag.ghost.style.top=(e.clientY-80)+'px';deck.classList.toggle('target',inside(e));}});
  source.addEventListener('pointerup',e=>{if(!drag)return;const moved=!!drag.ghost,valid=inside(e);clean();if(moved){suppress=true;setTimeout(()=>suppress=false,0);if(valid)play(source);}});
  source.addEventListener('pointercancel',clean);source.addEventListener('lostpointercapture',clean);
  source.addEventListener('click',()=>{if(!suppress)play(source);});
 });
 document.querySelector('#retro-prev').addEventListener('click',()=>{reset();select(selected-1)});document.querySelector('#retro-next').addEventListener('click',()=>{reset();select(selected+1)});document.querySelector('#retro-play').addEventListener('click',()=>play(sources[selected]));document.querySelector('#retro-stop').addEventListener('click',reset);select(0);
 cancel.addEventListener('click',reset);document.addEventListener('keydown',e=>{if(e.key==='Escape'){clean();reset();}});window.addEventListener('pagehide',()=>{clean();clearTimeout(timer);});window.addEventListener('pageshow',reset);
})();
