(() => {
 const projects={garden:{name:'Whispering Garden',category:'Patient experience',label:'WG',number:'01',color:'#c6d3ba',url:'whispering-garden.html',image:'assets/whispering-garden/garden-cover-photocomposite.webp'},sync:{name:'sync&sweat',category:'Data-centric product design',label:'S&S',number:'02',color:'#ded8cc',url:'sync-sweat.html',image:'assets/sync-sweat/app-flow.png'},uber:{name:'Food Miner',category:'AI decision design',label:'FM',number:'03',color:'#b6c7b0',url:'food-miner.html',image:'assets/uber-eats/food-miner-project-cover.png'}};
 const table=document.querySelector('#turntable'), platter=document.querySelector('#platter'), mounted=document.querySelector('#mounted'), label=document.querySelector('#mounted-label'), status=document.querySelector('#status'), cancel=document.querySelector('#cancel');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let timer=null,drag=null,busy=false;
 function reset(){clearTimeout(timer);busy=false;table.classList.remove('is-playing','is-target');mounted.hidden=true;cancel.hidden=true;status.textContent='Three projects. Different ways of thinking.';}
 function launch(key){
  if(busy)return;
  const p=projects[key];busy=true;
  try{sessionStorage.setItem('nemo-workspace-project',key)}catch{}
  if(reduced.matches){location.href=p.url;return;}
  label.replaceChildren(document.createTextNode(p.label));const number=document.createElement('span');number.textContent=p.number;label.append(number);label.style.background=p.color;
  mounted.hidden=false;table.classList.add('is-playing');status.textContent='Opening '+p.name;cancel.hidden=false;
  document.querySelector('#selected-preview').hidden=false;document.querySelector('#selected-image').src=p.image;document.querySelector('#selected-image').alt=p.name+' project preview';document.querySelector('#selected-category').textContent=p.category;document.querySelector('#selected-name').textContent=p.name;
  timer=setTimeout(()=>location.href=p.url,1250);
 }
 function inside(e){const r=platter.getBoundingClientRect();const x=(e.clientX-r.left-r.width/2)/(r.width/2+25),y=(e.clientY-r.top-r.height/2)/(r.height/2+25);return x*x+y*y<=1;}
 function cleanup(){if(!drag)return;drag.ghost?.remove();drag.source.classList.remove('is-dragging');table.classList.remove('is-target');drag=null;}
 document.querySelectorAll('.record-source').forEach(source=>{
  source.addEventListener('pointerdown',e=>{
   if(busy||e.button!==0||e.pointerType==='touch')return;
   drag={source,key:source.dataset.project,id:e.pointerId,startX:e.clientX,startY:e.clientY,ghost:null};source.setPointerCapture(e.pointerId);
  });
  source.addEventListener('pointermove',e=>{
   if(!drag||drag.source!==source)return;
   if(!drag.ghost&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>7){const ghost=document.createElement('div');ghost.className='drag-record';ghost.setAttribute('aria-hidden','true');ghost.append(source.firstElementChild.cloneNode(true));document.body.append(ghost);drag.ghost=ghost;source.classList.add('is-dragging');}
   if(drag.ghost){drag.ghost.style.transform=`translate(${e.clientX-56}px,${e.clientY-56}px)`;table.classList.toggle('is-target',inside(e));}
  });
  source.addEventListener('pointerup',e=>{
   if(!drag||drag.source!==source)return;
   const moved=!!drag.ghost,key=drag.key,valid=inside(e);cleanup();
   if(moved){source.dataset.suppressClick='true';setTimeout(()=>delete source.dataset.suppressClick,0);if(valid)launch(key);}
  });
  source.addEventListener('pointercancel',cleanup);
  source.addEventListener('lostpointercapture',cleanup);
  source.addEventListener('click',()=>{if(!source.dataset.suppressClick)launch(source.dataset.project)});
 });
 cancel.addEventListener('click',reset);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){cleanup();reset();}});
 window.addEventListener('pagehide',()=>{cleanup();clearTimeout(timer)});
 window.addEventListener('pageshow',reset);
 try{const saved=projects[sessionStorage.getItem('nemo-workspace-project')];if(saved){document.querySelector('#selected-preview').hidden=false;document.querySelector('#selected-image').src=saved.image;document.querySelector('#selected-image').alt=saved.name+' project preview';document.querySelector('#selected-category').textContent=saved.category;document.querySelector('#selected-name').textContent=saved.name;}}catch{}
})();
