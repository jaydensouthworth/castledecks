/** The authored Wayfarer graph, projected for a map. This is read-only UI data:
 * EXPEDITION_FIELDS.next remains the only authority for legal route choices. */
import {EXPEDITION_FIELDS,expeditionField} from './expedition-data.mjs';
import {REGION_ART} from './campaign-region-art.mjs';
import {encounterEnemyIntel} from './enemy-intel.mjs';
const freeze=Object.freeze;
export const CHARTER_MAP_POINTS=freeze({
 tollgate:freeze({x:11,y:50,portraitX:50,portraitY:12}),
 skyglass:freeze({x:36,y:24,portraitX:25,portraitY:37}),
 sunken:freeze({x:36,y:76,portraitX:75,portraitY:37}),
 ember:freeze({x:64,y:76,portraitX:75,portraitY:63}),
 frost:freeze({x:64,y:24,portraitX:25,portraitY:63}),
 stormcrown:freeze({x:89,y:50,portraitX:50,portraitY:88}),
});
export const CHARTER_ROADS=freeze(Object.values(EXPEDITION_FIELDS).flatMap(field=>field.next.map(to=>freeze({from:field.id,to}))));
export const CHARTER_STATE_LABELS=freeze({complete:'Won',current:'Current field',available:'Road open',locked:'Locked',bypassed:'Road not taken'});
export function canChooseCharterField(run,state,id){return !!run.choosing&&!state?.pendingOutcome&&run.choices.some(field=>field.id===id);}
export function charterNodeState(run,state,id){
 const field=expeditionField(id),index=run.state.path.indexOf(id);
 if(index>=0)return index<run.state.cleared?'complete':'current';
 if(run.state.path[field.leg-1])return 'bypassed';
 return canChooseCharterField(run,state,id)?'available':'locked';
}
export function charterRoadState(run,state,{from,to}){
 const first=expeditionField(from),index=run.state.path.indexOf(from);
 if(index>=0&&run.state.path[index+1]===to)return index+1<run.state.cleared?'complete':'chosen';
 if(index===run.state.path.length-1&&canChooseCharterField(run,state,to))return 'available';
 if((run.state.path[first.leg-1]&&run.state.path[first.leg-1]!==from)||(run.state.path[first.leg]&&run.state.path[first.leg]!==to))return 'bypassed';
 return 'locked';
}
export function charterRoadPath({from,to},portrait=false){
 const a=CHARTER_MAP_POINTS[from],b=CHARTER_MAP_POINTS[to];
 if(!a||!b)throw new RangeError('Unknown charter map point');
 const ax=portrait?a.portraitX:a.x,ay=portrait?a.portraitY:a.y,bx=portrait?b.portraitX:b.x,by=portrait?b.portraitY:b.y;
 // Percent-based viewBox: the same endpoints are used by HTML touch targets.
 return portrait?`M${ax} ${ay} C${ax} ${(ay+by)/2} ${bx} ${(ay+by)/2} ${bx} ${by}`:`M${ax} ${ay} C${(ax+bx)/2} ${ay} ${(ax+bx)/2} ${by} ${bx} ${by}`;
}
export function charterFieldBrief(run,state,id){
 const field=expeditionField(id),status=charterNodeState(run,state,id),enemies=encounterEnemyIntel({level:field.level,difficulty:run.profile.difficulty,types:Object.keys(field.counts)}),total=Object.values(field.counts).reduce((sum,count)=>sum+count,0);
 const aerial=enemies.filter(enemy=>enemy.air).reduce((sum,enemy)=>sum+field.counts[enemy.id],0);
 const specialists=enemies.filter(enemy=>['air','fireDragon','iceDragon','fireDemon','iceDemon','trebuchet','mount'].includes(enemy.id));
 return {field,status,statusLabel:CHARTER_STATE_LABELS[status],canChoose:canChooseCharterField(run,state,id),enemies,total,aerial,ground:total-aerial,art:REGION_ART[field.scenery].url,
  objective:field.objective==='break-keep'?'Break the keep':'Flag or elimination',
  threats:(specialists.length?specialists:enemies.slice(0,2)).map(enemy=>`${enemy.name} ×${field.counts[enemy.id]}`).join(' · '),
  note:status==='bypassed'?'This road was passed over. Try it on a fresh charter.':status==='locked'?`Win the preceding leg to open this road. Inspecting it does not change your route.`:status==='available'?'This road is open. Choose it explicitly, then Start from the lobby.':status==='complete'?(run.complete?'Four legs won. Export your charter to keep its route and record.':'This field is won. Your chosen road stays in this charter’s record.'):
   state?.pendingOutcome?'This result is still settling. Route changes wait for the settled victory.':state?.summary?.outcome==='defeat'?'Your retry uses this same field and seed. Combat earnings are kept.':state?.started?'Your live field is paused. Finish it before choosing another road.':'This field is prepared. Start from the lobby when ready.'};
}
