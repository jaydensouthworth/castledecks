import {SimulationClock} from './engine/clock.mjs';
import {Arrow,aimVector,sampleStandardHit,BasicShotCooldown} from './engine/ballistics.mjs';
import {DragShooter} from './engine/drag-shooter.mjs';
import {heroArrowImpact,troopStats,seededRandom} from './engine/combat.mjs';
const canvas=document.querySelector('#field'),ctx=canvas.getContext('2d');
const $=s=>document.querySelector(s),origin={x:350,y:610},ground=825;
let arrows=[],marks=[],shots=0,hits=0,last=performance.now(),angle=20,power=100,paused=false,queuedAim=null;
let targets=[],random=seededRandom(1234);const cooldown=new BasicShotCooldown(),shooter=new DragShooter({origin});
const makeTargets=()=>[{x:940,y:730,width:70,height:95},{x:1320,y:675,width:85,height:150},{x:1740,y:575,width:100,height:250}].map((hitbox,i)=>{const type=['grunt','tallGrunt','archer'][i],stats=troopStats(type);return {id:i+1,type,hp:stats.maxHp,maxHp:stats.maxHp,pierceMultiplier:i===1?1.4:1,hitbox}});
targets=makeTargets();
const clock=new SimulationClock({onTick:()=>{
 for(const arrow of arrows){if(!arrow.active)continue;arrow.step(()=>{const hit=sampleStandardHit(arrow,ground,targets);if(hit){arrow.active=false;arrow.reason=hit.kind;marks.push({x:arrow.x,y:arrow.y,angle:arrow.angle});if(hit.kind==='target'){hits++;const damage=heroArrowImpact({pierceMultiplier:hit.target.pierceMultiplier,random});hit.target.hp=Math.max(0,hit.target.hp-damage);$('#result').textContent=`Target ${hit.target.id}: ${damage} damage · ${hit.target.hp}/${hit.target.maxHp} HP · ${arrow.tick} ticks (${(arrow.tick/33).toFixed(2)} s)`;}}});if(arrow.active){arrow.trail.push([arrow.x,arrow.y]);if(arrow.trail.length>30)arrow.trail.shift();}}
 arrows=arrows.filter(a=>a.active);if(marks.length>60)marks.shift();
 const attempted=shooter.step()??queuedAim;queuedAim=null;
 if(attempted&&!fire(attempted))$('#result').textContent=attempted.canFire?'Bow is still reloading. Try again when ready.':'This shot is below the recovered speed threshold (>5 px/tick).';
 cooldown.step();
}});
function fire(v){if(paused||!v.canFire||!cooldown.use())return false;const a=new Arrow({...origin,vx:v.vx,vy:v.vy});a.trail=[];arrows.push(a);shots++;$('#result').textContent=`Shot ${shots}: velocity (${v.vx.toFixed(3)}, ${v.vy.toFixed(3)}) px/tick · ${(v.power*100).toFixed(0)}% power`;return true;}
function sliderShot(){const rad=angle*Math.PI/180;return aimVector(origin,{x:origin.x-180*power/100*Math.cos(rad),y:origin.y+180*power/100*Math.sin(rad)})}
$('#fire').onclick=()=>queuedAim=sliderShot();
$('#reset').onclick=()=>{arrows=[];marks=[];targets=makeTargets();random=seededRandom(1234);shots=0;hits=0;shooter.cancel();queuedAim=null;$('#result').textContent='Field reset. All three targets are ready.'};
$('#pause').onclick=()=>{paused=!paused;clock.paused=paused;$('#pause').textContent=paused?'Resume':'Pause';last=performance.now()};
$('#mode').addEventListener('change',()=>{shooter.cancel();shooter.mode=$('#mode').value});
for(const id of ['angle','power'])$('#'+id).addEventListener('input',()=>{angle=Number($('#angle').value);power=Number($('#power').value);$('#angleOut').textContent=angle+'°';$('#powerOut').textContent=power+'%'});
const position=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*2000/r.width,y:(e.clientY-r.top)*1000/r.height}};
canvas.addEventListener('pointerdown',e=>{const p=position(e);if(p.y>=865||paused)return;if(shooter.mode==='classic'&&Math.hypot(p.x-origin.x+.3,p.y-origin.y+.3)>69.2){$('#result').textContent='Classic mode: begin inside the ring around the archer, then pull back.';return}canvas.setPointerCapture(e.pointerId);shooter.press(p);e.preventDefault()});
canvas.addEventListener('pointermove',e=>shooter.move(position(e)));
canvas.addEventListener('pointerup',e=>shooter.release(position(e)));
canvas.addEventListener('pointercancel',()=>shooter.cancel());
document.addEventListener('visibilitychange',()=>{last=performance.now();shooter.cancel()});
function poly(points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function castle(){ctx.fillStyle='#697565';ctx.fillRect(222,650,245,175);ctx.fillStyle='#87947b';ctx.fillRect(212,610,78,215);ctx.fillRect(402,610,78,215);ctx.fillRect(275,665,145,160);for(let x=210;x<482;x+=24){if(x<290||x>400)ctx.fillRect(x,586,15,30)}ctx.fillStyle='#303f36';ctx.fillRect(245,678,15,38);ctx.fillRect(431,678,15,38);ctx.beginPath();ctx.arc(348,781,34,Math.PI,0);ctx.lineTo(382,825);ctx.lineTo(314,825);ctx.fill();line(344,607,344,506,'#e3d4ae',4);poly([[346,508],[407,518],[346,539]],'#d5b777');ctx.fillStyle='#d8d4b5';ctx.beginPath();ctx.arc(350,585,10,0,Math.PI*2);ctx.fill();line(350,596,350,625,'#d8d4b5',7);line(350,606,373,604,'#d8d4b5',5);ctx.strokeStyle='#d6b974';ctx.lineWidth=4;ctx.beginPath();ctx.arc(364,607,25,-1.15,1.15);ctx.stroke();line(374,584,374,630,'#d8d4b5',2)}
function arrowDraw(a,color){const pose=a.draw??a;ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);line(-24,0,6,0,color,2.6);poly([[8,0],[-2,-4],[-2,4]],color);line(-20,0,-27,-6,color,2);line(-20,0,-27,6,color,2);ctx.restore()}
function draw(){const sky=ctx.createLinearGradient(0,0,0,850);sky.addColorStop(0,'#475d61');sky.addColorStop(.75,'#a7ac8b');sky.addColorStop(1,'#a2a584');ctx.fillStyle=sky;ctx.fillRect(0,0,2000,1000);ctx.fillStyle='#dfd5a2';ctx.beginPath();ctx.arc(1480,208,66,0,Math.PI*2);ctx.fill();poly([[0,650],[180,415],[360,610],[565,312],[780,535],[1090,337],[1380,614],[1610,382],[1850,520],[2000,320],[2000,1000],[0,1000]],'#748677');poly([[0,742],[190,595],[465,697],[770,489],[1040,745],[1310,500],[1510,703],[1820,542],[2000,697],[2000,1000],[0,1000]],'#617962');poly([[0,788],[340,742],[690,783],[930,728],[1275,784],[1620,745],[2000,770],[2000,1000],[0,1000]],'#49674e');ctx.fillStyle='#333f2e';ctx.fillRect(0,ground,2000,175);ctx.fillStyle='#8e9e65';ctx.fillRect(0,ground,2000,6);for(let i=0;i<70;i++){const x=(i*137.7)%2000;line(x,ground,x+8,ground-8-(i%4)*3,'#9cab6d',2)}castle();
 for(const target of targets){const b=target.hitbox;ctx.globalAlpha=target.hp>0?1:.35;ctx.fillStyle='#6e7255';ctx.fillRect(b.x+8,b.y+8,b.width-16,b.height-8);ctx.fillStyle='#b8a16e';ctx.fillRect(b.x,b.y,b.width,10);line(b.x-6,ground,b.x+b.width+6,ground,'#c4b57e',5);ctx.strokeStyle=target.hp>0?'#f0db9d':'#8d9e79';ctx.lineWidth=3;ctx.setLineDash([7,6]);ctx.strokeRect(b.x,b.y,b.width,b.height);ctx.setLineDash([]);ctx.fillStyle='#e9e3b9';ctx.font='22px system-ui';ctx.textAlign='center';ctx.fillText(target.hp>0?`${target.id} · ${target.hp}/${target.maxHp}`:'✓',b.x+b.width/2,b.y-24);ctx.fillStyle='#3f4d36';ctx.fillRect(b.x-6,b.y-15,b.width+12,5);ctx.fillStyle='#d6ce8a';ctx.fillRect(b.x-6,b.y-15,(b.width+12)*target.hp/target.maxHp,5);ctx.globalAlpha=1}
 for(const a of marks)arrowDraw(a,'#d8bd7c');
 for(const a of arrows){ctx.strokeStyle='#ebd9a62b';ctx.lineWidth=2;ctx.beginPath();a.trail.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();arrowDraw(a,'#ffefb5')}
 const drag=shooter.active?{anchor:shooter.active.anchor,pointer:shooter.pointer}:null;const aim=shooter.active?.aim??sliderShot();if(shooter.mode==='classic'&&!drag){ctx.strokeStyle='#e8dc9a70';ctx.lineWidth=2;ctx.beginPath();ctx.arc(origin.x-.3,origin.y-.3,69.2,0,Math.PI*2);ctx.stroke();}if(drag){ctx.strokeStyle='#dcdba2';ctx.lineWidth=2;ctx.setLineDash([8,8]);line(drag.anchor.x,drag.anchor.y,drag.pointer.x,drag.pointer.y,'#e1dca4',2);ctx.setLineDash([]);ctx.strokeStyle='#e2d49c50';ctx.beginPath();ctx.arc(drag.anchor.x,drag.anchor.y,180,0,Math.PI*2);ctx.stroke();line(origin.x,origin.y,origin.x+aim.vx*5,origin.y+aim.vy*5,'#f8e9b0',4)}
 ctx.fillStyle='#d6c995';ctx.font='20px ui-monospace';ctx.textAlign='left';ctx.fillText(`SHOTS ${shots}   HITS ${hits}   ${paused?'PAUSED':cooldown.ready?'BOW READY':'RELOADING'}`,45,935);ctx.fillStyle='#697657';ctx.fillRect(45,955,300,6);ctx.fillStyle='#d6c995';ctx.fillRect(45,955,300*(1-cooldown.remaining/60),6);
 $('#fire').disabled=!cooldown.ready||paused;$('#live').textContent=`33 Hz · ${arrows.length} in flight · ${clock.tick} ticks`;
}
function frame(now){const elapsed=Math.min((now-last)/1000,.25);last=now;if(!document.hidden)clock.advance(elapsed);draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);
