import {clipRect,measureOcclusion,touchConflicts} from './viewport-metrics.mjs';
import {paintedVisible,interactionVisible} from './viewport-visibility.mjs';
const $=id=>document.getElementById(id),frame=$('gameFrame'),device=$('device'),stage=$('previewStage'),box=$('scaledBox'),svg=$('inspection');
let width=915,height=360,lastSignature='',scale=1;
const svgNS='http://www.w3.org/2000/svg';
function drawRect(rect,color,fill='none',dash=''){
 const node=document.createElementNS(svgNS,'rect');for(const [key,value] of Object.entries({...rect,stroke:color,fill,'stroke-width':1.5,'stroke-dasharray':dash}))node.setAttribute(key,String(value));svg.append(node);
}
function fit(){
 const maxWidth=Math.max(240,stage.clientWidth-24),maxHeight=Math.max(300,Math.min(1000,innerHeight*.74));scale=Math.min(1,maxWidth/width,maxHeight/height);
 device.style.width=width+'px';device.style.height=height+'px';device.style.transform='scale('+scale+')';box.style.width=width*scale+'px';box.style.height=height*scale+'px';svg.setAttribute('viewBox','0 0 '+width+' '+height);$('scaleMeasure').textContent=Math.round(scale*100)+'%';
}
function setSize(nextWidth,nextHeight,rotation=false){
 const valid=value=>Number.isFinite(value)&&value>=240&&value<=2000;
 if(!valid(nextWidth)||!valid(nextHeight)){$('status').textContent='Choose dimensions between 240 and 2000 CSS pixels';return;}
 width=Math.round(nextWidth);height=Math.round(nextHeight);$('viewWidth').value=width;$('viewHeight').value=height;lastSignature='';fit();
 if(rotation){try{frame.contentWindow.dispatchEvent(new Event('orientationchange'));}catch{}}
 requestAnimationFrame(inspect);
}
function record(node){const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,label:node.getAttribute('aria-label')||node.id||node.textContent.trim().slice(0,40)||node.tagName};}
function inspect(){
 let doc,win;try{doc=frame.contentDocument;win=frame.contentWindow;if(!doc?.querySelector('#battlefield'))throw new Error('loading');}catch{$('status').textContent='Waiting for the game…';return;}
 const viewport={width:win.innerWidth,height:win.innerHeight};
 const modal=[...doc.querySelectorAll('.panel,.veil,[data-hud-layer="modal"]')].filter(node=>interactionVisible(node,win)).sort((a,b)=>(Number(win.getComputedStyle(b).zIndex)||0)-(Number(win.getComputedStyle(a).zIndex)||0))[0];
 const surfaces=[...doc.querySelectorAll('[data-hud-surface]')].filter(node=>paintedVisible(node,win));
 // Keep older revisions inspectable while the new HUD is being integrated.
 const fallback=surfaces.length?surfaces:[...doc.querySelectorAll('.game-brand,.heraldic-plate,.selected-ability,.bar-step,.skill-button,.movement button,.tactical-controls button,.test-mode-badge,.assist-controls,.top-actions button,.flag-ribbon[data-alert="true"]')].filter(node=>paintedVisible(node,win));
 const rects=fallback.map(record),metrics=measureOcclusion(rects,viewport.width,viewport.height);
 const controlNodes=[...new Set([...(modal?modal.querySelectorAll('button,input,select,a,summary'):doc.querySelectorAll('[data-hud-control],.command-deck button,.top-actions button'))].filter(node=>interactionVisible(node,win)).map(node=>node.matches('input[type=checkbox],input[type=radio]')?(node.closest('label')??node):node))];
 const controls=[];let clippedControls=0;
 for(const node of controlNodes){const full=record(node);let shown=clipRect(full,{x:0,y:0,width:viewport.width,height:viewport.height});for(let parent=node.parentElement;parent&&shown;parent=parent.parentElement){const style=win.getComputedStyle(parent);if(/hidden|auto|scroll|clip/.test(style.overflow+style.overflowX+style.overflowY))shown=clipRect(shown,record(parent));}if(!shown)continue;const partial=shown.width<full.width-1||shown.height<full.height-1;if(modal&&partial){clippedControls++;continue;}controls.push({...shown,label:full.label});}
 const targets=touchConflicts(controls),heroMode=doc.querySelector('.battle-screen')?.dataset.heroMode??'garrisoned';
 const budget=heroMode==='foot'?.22:.16;const warnings=[];
 const blocked=[];
 if(!modal)for(let row=0;row<5;row++)for(let col=0;col<7;col++){const x=metrics.zone.x+(col+.5)*metrics.zone.width/7,y=metrics.zone.y+(row+.5)*metrics.zone.height/5;const target=doc.elementFromPoint(x,y);if(target!==doc.querySelector('#battlefield'))blocked.push({x,y,label:target?.id||target?.tagName||'none'});}
 if(blocked.length)warnings.push(blocked.length+' of 35 combat points intercept aim input');
 if(targets.undersized.length)warnings.push(targets.undersized.length+' targets below 44px');
 if(targets.overlaps.length)warnings.push(targets.overlaps.length+' overlapping targets');
 if(!modal&&metrics.zoneFraction>.005)warnings.push('persistent HUD enters the clear combat zone');
 if(!modal&&metrics.fraction>budget)warnings.push('HUD exceeds '+Math.round(budget*100)+'% area budget');
 const cutout=$('simulateWideCutout').checked?44:$('simulateCutout').checked?24:0;
 const cutoutControls=controls.filter(r=>r.x<cutout||r.x+r.width>viewport.width-cutout);
 if(cutout&&cutoutControls.length)warnings.push(cutoutControls.length+' controls enter simulated cutouts');
 const canvas=doc.querySelector('#battlefield').getBoundingClientRect(),coverage=Math.abs(canvas.x)<1&&Math.abs(canvas.y)<1&&Math.abs(canvas.width-viewport.width)<1&&Math.abs(canvas.height-viewport.height)<1;
 if(!coverage)warnings.push('canvas does not match viewport');
 $('hudMeasure').textContent=modal?'Menu open':(100*metrics.fraction).toFixed(1)+'%';$('zoneMeasure').textContent=modal?'Menu open':(100*metrics.zoneFraction).toFixed(1)+'%';$('touchMeasure').textContent=targets.undersized.length+' / '+targets.overlaps.length;
 const loadedBuild=doc.querySelector('#testingBuild')?.textContent||'Build unknown';
 $('status').textContent=loadedBuild+' · '+viewport.width+' × '+viewport.height+' CSS pixels · '+(modal?'menu inspection':heroMode+' combat HUD');
 $('details').textContent=modal?'Menus intentionally cover the battle. Only fully visible targets are counted; scroll to reveal the rest. Close or begin play to inspect combat.':warnings.length?warnings.join(' · '):'Within the area/target budgets. Now aim, follow advancing enemies and switch equipped bars, select skills, summon and fire; 35 combat points pass input through. Geometry alone cannot prove good play.';
 document.querySelector('.measurement').dataset.state=warnings.length?'warn':'good';
 const signature=JSON.stringify({rects,zone:metrics.zone,modal:!!modal,cutout,zones:$('showZones').checked,outlines:$('showSurfaces').checked});
 if(signature!==lastSignature){lastSignature=signature;svg.replaceChildren();if(!modal&&$('showZones').checked)drawRect(metrics.zone,'#8fe1bc','#43c89309','6 5');if(!modal&&$('showSurfaces').checked)for(const r of metrics.rects)drawRect(r,'#ffd088','#e2a94213');if(cutout){drawRect({x:0,y:0,width:cutout,height:viewport.height},'#ef9693','#7c223b99');drawRect({x:viewport.width-cutout,y:0,width:cutout,height:viewport.height},'#ef9693','#7c223b99');}}
}
function cutouts(){try{const root=frame.contentDocument.documentElement,side=$('simulateWideCutout').checked?44:$('simulateCutout').checked?24:0;for(const edge of ['left','right'])root.style.setProperty('--preview-safe-'+edge,side+'px');root.style.setProperty('--preview-safe-bottom',$('simulateBottomInset').checked?'24px':'0px');lastSignature='';inspect();}catch{}}
$('preset').addEventListener('change',()=>{if($('preset').value==='custom')return;const [w,h]=$('preset').value.split(',').map(Number);setSize(w,h);});
$('applySize').addEventListener('click',()=>{$('preset').value='custom';setSize(Number($('viewWidth').value),Number($('viewHeight').value));});
$('rotate').addEventListener('click',()=>{$('preset').value='custom';setSize(height,width,true);});
$('reloadPreview').addEventListener('click',()=>{frame.src='./battle?mode=test';lastSignature='';});
$('midgamePreview').addEventListener('click',()=>{frame.src='./battle?mode=demo';lastSignature='';});
window.addEventListener('message',event=>{if(event.source===frame.contentWindow&&event.origin===location.origin&&event.data?.type==='bowmaster-preview-exit-demo'){frame.src='./battle?mode=test';lastSignature='';}});
for(const id of ['showZones','showSurfaces'])$(id).addEventListener('change',inspect);
function collision(){frame.contentWindow?.postMessage({type:'bowmaster-preview-collision',enabled:$('showCollision').checked},location.origin);}
$('showCollision').addEventListener('change',collision);
for(const id of ['simulateCutout','simulateWideCutout','simulateBottomInset'])$(id).addEventListener('change',cutouts);$('refreshMetrics').addEventListener('click',inspect);frame.addEventListener('load',()=>{cutouts();collision();inspect();});
window.addEventListener('resize',fit);setSize(width,height);setInterval(inspect,500);
