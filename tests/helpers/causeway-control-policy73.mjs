/** Test-only scripted Classic-control policy. No engine edits or Auto aim.
 * Precise state-observed aim is not a human/native playability claim.
 * Only movement/mouse input, real shooter events, hotbar and Army orders mutate.
 */
import assert from 'node:assert/strict';
function dragToHead(b,u) {
 const origin=b.hero.launchPosition,speed=22.8,head=u.headbox;
 const headOffset=head?head.y+head.height/2-u.y:-60;
 // Current observed velocity, not future RNG or future state, predicts lead.
 const velocity=u.hp>0?u.vx||0:0;
 const position=n=>{const x=Math.max(0,Math.min(2000,u.x+velocity*(n+1)));return {x,y:b.elevationAt(x)+headOffset};};
 const equation=n=>{const p=position(n),vx=(p.x-origin.x)/n,vy=(p.y-origin.y-.3*n*(n-1)/2)/n;return vx*vx+vy*vy-speed*speed;};
 let hi=.5;for(;hi<200&&equation(hi)>0;hi+=.5){}
 if(hi>=200)return null;
 let lo=hi-.5;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(equation(mid)>0)lo=mid;else hi=mid;}
 const moves=(lo+hi)/2,p=position(moves),vx=(p.x-origin.x)/moves,vy=(p.y-origin.y-.3*moves*(moves-1)/2)/moves;
 return {pointer:{x:origin.x-vx/speed*180,y:origin.y-vy/speed*180},guide:{origin:{...origin},target:{type:u.type,x:u.x,y:u.y,vx:u.vx,hp:u.hp},angleDegrees:Math.atan2(-vy,vx)*180/Math.PI,power:100,predictedMoves:moves}};
}
export function makePolicy(config) {
 let phase=0,pointer=null,nextShot=0,recoveryQueued=false;
 const recruits=config.plan==='mixed'?[['mount',0],['grunt',1],['archer',2],['priest',3]]:config.plan==='infantry'?[['grunt',0],['archer',1],['priest',2],['grunt',331]]:config.plan==='riders'?[['mount',0],['archer',1],['priest',2],['mount',331]]:[];
 return b=>{
  const control={input:{left:false,right:false,mouseDown:false},shooter:[],orders:[]};
  if(b.tick===0&&recruits.length)control.orders.push(['rally','center','frontline'],['rally','center','support']);
  for(const [id,tick] of recruits)if(b.tick===tick)control.select=b.profile.skills.find(s=>s.id===id).binding%10;
  if(config.recover&&!recoveryQueued&&b.ownFlag.status===0){control.select=5;recoveryQueued=true;}
  let targetX=1050;
  if(config.cleanup==='advance'&&b.objectiveProgress.secured){const remaining=b.badTeam.filter(u=>u.hp>0).sort((a,c)=>a.x-c.x);if(remaining.length)targetX=Math.max(400,Math.min(1950,remaining[0].x-150));}
  if(!phase&&b.hero.x<targetX-2)control.input.right=true;else if(!phase&&b.hero.x>targetX+2)control.input.left=true;
  if(config.policy==='garrison'||config.policy==='home'&&(b.badTeam.some(u=>u.hp>0)||b.enemies.remaining>0)||b.tick<(config.hold||0)){control.input.left=false;control.input.right=false;}
  const enemies=b.badTeam.filter(u=>u.hp>0&&u.canGetHit!==false&&u.x<1950).sort((a,c)=>a.x-c.x);
  if(config.fire!==false){
   if(phase===0&&b.activeSkill.cooldown===0&&enemies.length&&b.tick>=nextShot){const aim=dragToHead(b,enemies[0]);if(aim){pointer=aim.pointer;control.guide=aim.guide;control.input.left=false;control.input.right=false;control.input.mouseDown=true;control.input.pointerX=pointer.x;control.shooter.push(['press',{...b.hero.launchPosition}]);phase=1;}}
   else if(phase===1){control.input.left=false;control.input.right=false;control.input.mouseDown=true;control.shooter.push(['move',pointer]);phase=2;}
   else if(phase===2){control.input.left=false;control.input.right=false;control.shooter.push(['release',pointer]);phase=0;nextShot=b.tick+1;}
  }
  return control;
 };
}
export function applyControl(b,c){
 // This is the complete permitted write surface in every evidence run.
 Object.assign(b.input,c.input);
 for(const order of c.orders??[])assert.equal(b.setArmyOrder(...order),true);
 if(c.select!==undefined)b.selectSkill(c.select);
 for(const [method,pointer] of c.shooter??[]){assert.ok(['press','move','release'].includes(method));b.shooter[method](pointer);}
}
