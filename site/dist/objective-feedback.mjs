/** Read-only, frame-local presentation for an optional objective.
 * No actor creation, cached identities, input listeners, timers or RNG. The
 * engine owns target membership, allegiance, progress and outcome precedence.
 */
import {worldToScreen} from './world-camera.mjs';
import {FLAG_STATUS as FS} from './engine/flag-troop.mjs';

export const BATTERY_BRIEF=Object.freeze({
 title:'Battery Interception',
 goal:'Silence both marked enemy trebuchets and keep your home flag at base. Only Battery I and Battery II count. If both are resolved while your flag is away, recover your home flag to finish. Protect your hero and home flag; losing either still ends the attempt.',
 counterplay:'Fire deals double damage to trebuchets; piercing damage is halved. Protect your own fragile siege from escort pressure: priests cannot repair vehicles. Destroying the enemy keep or taking its flag does not replace either marked target.',
 opening:'Both guns and their opening escort are already deployed at preparation. They come from this finite company, not extra reinforcements.',
});
const isBattery=progress=>progress?.type==='intercept-battery'&&progress.total===2;
const boundedCount=value=>Number.isInteger(value)?Math.max(0,Math.min(2,value)):0;

/** Resolved includes secured originals; never infer progress from allied units.
 * A completed target count is not itself a victory announcement. */
export function objectiveFeedbackState(battle){
 const progress=battle?.objectiveProgress;
 if(!isBattery(progress))return null;
 const resolved=boundedCount(progress.resolved),neutralized=boundedCount(progress.neutralized),secured=boundedCount(progress.secured);
 const outcome=battle.outcome??battle.summary?.outcome;
 const phase=outcome==='defeat'?'defeat':outcome==='victory'?'victory':progress.state;
 const status=phase==='defeat'?'Attempt lost':phase==='victory'?'Battery cleared':phase==='recover-flag'?'Recover home flag':phase==='completed'?'Battery resolved':phase==='pending'?'Prepare the battery':resolved===1?'Silence last gun':'Silence both guns';
 const reason=phase==='defeat'?(battle.ownFlag?.status===FS.CAPTURED?'Your home flag was captured.':battle.hero&&(battle.hero.dead||battle.hero.hp<=0)?'Your hero fell.':null):null;
 const counts=`${resolved}/2 engines resolved · ${neutralized} destroyed · ${secured} secured`;
 return Object.freeze({phase,resolved,neutralized,secured,reason,title:`Battery · ${resolved}/2`,status,
  portrait:`Battery ${resolved}/2 · ${status}`,
  brief:`${BATTERY_BRIEF.title} · ${counts}. ${status}. ${reason?reason+' ':''}Silence both marked guns and finish with your flag at base. Fire deals double damage to siege. Protect your own fragile siege from the escort; priests cannot repair vehicles. Hero or home-flag loss ends the attempt.`,
  ariaLabel:`Battery Interception. ${counts}. ${status}.`,
 });
}
const write=(node,text)=>{if(node&&node.textContent!==text)node.textContent=text;};
/** Call after the ordinary HUD and portrait-status writers each frame. The
 * default HUD restores ordinary text; this only clears its own scoped metadata
 * and Pause paragraph when leaving the objective, so other modes retain theirs.
 */
export function updateObjectiveFeedback(battle,root=globalThis.document){
 const state=objectiveFeedbackState(battle),standard=root?.querySelector('.live-battle-standard'),brief=root?.querySelector('#batteryObjectiveBrief');
 if(standard){
  if(state){standard.dataset.objective='intercept-battery';standard.setAttribute('aria-label',state.ariaLabel);}
  else if(standard.dataset.objective==='intercept-battery'){delete standard.dataset.objective;standard.setAttribute('aria-label','Battle progress');}
 }
 if(brief){brief.classList[state?'remove':'add']('hidden');write(brief,state?.brief??'');}
 if(!state)return null;
 write(root?.querySelector('#combatBattleTitle'),state.title);
 write(root?.querySelector('#combatEnemyState'),state.status);
 write(root?.querySelector('#viewStatus'),state.portrait);
 return state;
}

const MARKER_WIDTH=106,MARKER_HEIGHT=32,MARKER_GAP=6;
const markerState=Object.freeze({
 active:Object.freeze({caption:'TARGET',edge:'#ffdb88',ink:'#fff0be',background:'#36261bed',symbol:'target'}),
 secured:Object.freeze({caption:'SECURED',edge:'#9ce8d0',ink:'#d8fff0',background:'#173b35ed',symbol:'check'}),
 neutralized:Object.freeze({caption:'DESTROYED',edge:'#c5cbd0',ink:'#f0f0e5',background:'#292b30ed',symbol:'cross'}),
});
const finite=value=>Number.isFinite(value);
const intersects=(a,b)=>a.left<b.left+b.width+MARKER_GAP&&a.left+a.width+MARKER_GAP>b.left&&a.top<b.top+b.height+MARKER_GAP&&a.top+a.height+MARKER_GAP>b.top;

/** CSS-pixel labels anchored to original real actors. The siege beam reaches
 * 150 world units above its base, so its label/leader stay above a 160-unit
 * envelope, as well as above the engine-supplied collision-body markerY.
 * Close labels stack upward, never down onto the body. Offscreen targets do not
 * create fake edge actors; the existing portrait map lets the player pan to them.
 */
export function objectiveMarkerLayout(battle,camera){
 if(!isBattery(battle?.objectiveProgress)||camera?.renderable===false||![camera?.width,camera?.height,camera?.scale,camera?.offsetX,camera?.offsetY].every(finite)||camera.scale<=0||camera.width<MARKER_WIDTH+16||camera.height<=0)return [];
 const markers=Array.isArray(battle.objectiveMarkers)?battle.objectiveMarkers:[],seen=new Set(),result=[];
 for(const marker of markers){
  if(!['battery-1','battery-2'].includes(marker?.id)||seen.has(marker.id)||!markerState[marker.state]||![marker.x,marker.y,marker.markerY].every(finite))continue;
  seen.add(marker.id);
  const anchor=worldToScreen(camera,{x:marker.x,y:Math.min(marker.markerY,marker.y-160)});
  if(anchor.x<0||anchor.x>camera.width||anchor.y>camera.height)continue;
  const left=Math.max(8,Math.min(camera.width-MARKER_WIDTH-8,anchor.x-MARKER_WIDTH/2));
  const layout={id:marker.id,label:marker.id==='battery-1'?'Battery I':'Battery II',state:marker.state,
   left,top:anchor.y-MARKER_HEIGHT-8,width:MARKER_WIDTH,height:MARKER_HEIGHT,anchorX:anchor.x,anchorY:anchor.y,...markerState[marker.state]};
  for(const prior of result)if(intersects(layout,prior))layout.top=Math.min(layout.top,prior.top-MARKER_HEIGHT-MARKER_GAP);
  // Do not clamp the label down onto a target when the camera crops the sky.
  if(layout.top+layout.height<0)continue;
  result.push(Object.freeze(layout));
 }
 return Object.freeze(result);
}
function line(ctx,x,y,x2,y2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
function symbol(ctx,kind,x,y){
 if(kind==='check'){line(ctx,x-4,y,x-1,y+3);line(ctx,x-1,y+3,x+5,y-4);return;}
 if(kind==='cross'){line(ctx,x-4,y-4,x+4,y+4);line(ctx,x+4,y-4,x-4,y+4);return;}
 ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();ctx.stroke();
 ctx.fillRect(x-1,y-1,2,2);
}
/** Draw after restoring the world transform, with only backing-store DPR active.
 * All label geometry/fonts are CSS pixels. This paints into the existing canvas
 * and cannot take pointer capture, focus, or intercept an aiming event.
 */
export function drawObjectiveMarkers(ctx,battle,camera){
 const markers=objectiveMarkerLayout(battle,camera);
 if(!markers.length)return 0;
 ctx.save();ctx.globalAlpha=1;
 for(const marker of markers){
  const {left,top,width,height,anchorX,anchorY}=marker,center=left+width/2,bottom=top+height;
  ctx.strokeStyle=marker.edge;ctx.lineWidth=1;
  line(ctx,center,bottom,anchorX,anchorY-3);
  line(ctx,anchorX-3,anchorY-6,anchorX,anchorY-3);line(ctx,anchorX+3,anchorY-6,anchorX,anchorY-3);
  ctx.fillStyle=marker.background;ctx.fillRect(left,top,width,height);
  ctx.strokeRect(left+.5,top+.5,width-1,height-1);
  ctx.fillStyle=marker.edge;ctx.fillRect(left,top,3,height);
  ctx.strokeStyle=marker.ink;ctx.fillStyle=marker.ink;ctx.lineWidth=1.7;symbol(ctx,marker.symbol,left+13,top+16);
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='bold 11px system-ui,sans-serif';ctx.fillText(marker.label,left+24,top+10);
  ctx.font='bold 10px system-ui,sans-serif';ctx.fillText(marker.caption,left+24,top+23);
 }
 ctx.restore();return markers.length;
}
