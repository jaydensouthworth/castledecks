import test from 'node:test';import assert from 'node:assert/strict';
import {assistedAutoAim,validateAutoAimZones,AUTO_ASSIST} from '../site/dist/engine/assisted-auto-aim.mjs';
import {autoAim,createShooter} from '../site/dist/engine/alternate-shooter.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {SKILLS,PlayerProfile} from '../site/dist/engine/progression.mjs';
import {Arrow,analyticPosition,sampleStandardHit} from '../site/dist/engine/ballistics.mjs';
import {unlockTestSkills} from '../site/dist/testing.mjs';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} ~= ${b}`);
const home={x:350,y:571.728515625},far={x:1800,y:100};
function battle(options={}){const b=new CampaignBattle({level:16,testing:true,...options});b.profile.shootingMode='auto_aim';b.protectedTesting=true;b.activeSkill.cooldown=0;return b;}

test('Battle16 range assist reaches high/right target on both arcs at unchanged launch speed and bounded gravity',()=>{
 for(const angleMode of [0,1]){const a=assistedAutoAim(home,far,{angleMode});assert.equal(autoAim(home,far,{angleMode}).canFire,false);assert.equal(a.canFire,true);assert.equal(a.rangeAssisted,true);near(Math.hypot(a.vx,a.vy),22.8);assert.ok(a.gravity>=.1&&a.gravity<.3);
  const t=(far.x-home.x)/a.vx;near(home.y+a.vy*t+.5*a.gravity*t*t,far.y,1e-7);
 }
});
test('already-reachable Auto shots retain exactly the source launch vectors and gravity at every tested power/arc',()=>{
 let count=0;for(const powerPercent of [50,75,100])for(const angleMode of [0,1])for(const x of [0,351,650,1000,1500,1990])for(const y of [-100,100,350,700,900]){
  const target={x,y},options={powerPercent,angleMode},old=autoAim(home,target,options),now=assistedAutoAim(home,target,options);
  if(old.canFire&&Number.isFinite(old.vx)&&Number.isFinite(old.vy)){assert.equal(now.rangeAssisted,false);assert.equal(now.vx,old.vx);assert.equal(now.vy,old.vy);assert.equal(now.gravity,.3);assert.deepEqual(analyticPosition({...home,...now},50),analyticPosition({...home,...old},50));count++;}
 }assert.ok(count>75);
});
test('leftward, vertical, near-vertical and below-origin aims stay finite and bounded',()=>{
 for(const angleMode of [0,1])for(const origin of [{x:1800,y:571},home])for(const target of [{x:100,y:0},{x:origin.x,y:100},{x:origin.x+1e-8,y:100},{x:origin.x,y:800}]){
  const a=assistedAutoAim(origin,target,{angleMode});assert.equal(a.canFire,true);assert.ok([a.vx,a.vy,a.gravity].every(Number.isFinite));near(Math.hypot(a.vx,a.vy),22.8);assert.ok(a.gravity>=.1&&a.gravity<=.3);if(target.x<origin.x)assert.ok(a.vx<0);
 }
});
test('invalid, coincident, truly excessive and outside-assist points stay rejected with a meaningful hard limit',()=>{
 for(const point of [home,{x:NaN,y:0},{x:100,y:Infinity},{x:10000,y:-10000}])assert.equal(assistedAutoAim(home,point).canFire,false);
 for(const powerPercent of [NaN,0,49,101,Infinity])assert.equal(assistedAutoAim(home,far,{powerPercent}).canFire,false);
 assert.equal(assistedAutoAim({x:0,y:10000},{x:2000,y:-350}).canFire,false);
 assert.equal(assistedAutoAim(home,far,{powerPercent:50}).canFire,false);
});
test('standalone source controller remains unchanged; explicit battle Auto gets assist on every difficulty',()=>{
 const reference=createShooter({mode:'auto_aim',origin:home});reference.press(far);assert.equal(reference.step(),null);
 for(const difficulty of ['easy','medium','hard','insane']){const profile=new PlayerProfile();profile.difficulty=difficulty;profile.shootingMode='auto_aim';const b=battle({profile});b.shooter.press(far);const a=b.shooter.step();assert.equal(a.rangeAssisted,true);assert.equal(a.canFire,true);}
});
test('all 30 actual terrains pass explicit high/ground required-zone checks from the home launch at full power',()=>{
 let checks=0;for(let level=1;level<=30;level++){const b=new CampaignBattle({level});const zones=[];for(const x of [100,350,700,1050,1400,1700,1900]){const y=b.elevationAt(x);zones.push({name:`${level}-ground-${x}`,x:x-8,y:y-45,width:16,height:40},{name:`${level}-air-${x}`,x:x-25,y:y-350,width:50,height:80});}
  for(const angleMode of [0,1]){const result=validateAutoAimZones({origins:[b.hero.launchPosition],zones,angleMode});assert.equal(result.ok,true,JSON.stringify({level,angleMode,result}));checks+=result.checkedZones;}
 }assert.equal(checks,840);
});
test('reusable zone validator catches unsupported generated stages and invalid/missing requirements',()=>{
 const fixture=(width,height)=>({origins:[{x:0,y:height-30}],zones:[{name:'required-upper-corner',x:width-50,y:-340,width:50,height:80}],bounds:{...AUTO_ASSIST,maxX:width,maxY:height}});
 for(const [width,height] of [[1200,600],[2000,1000],[2000,350]])assert.equal(validateAutoAimZones(fixture(width,height)).ok,true);
 for(const [width,height] of [[6000,1000],[2000,10000]]){const r=validateAutoAimZones(fixture(width,height));assert.equal(r.ok,false);assert.equal(r.issues[0].reason,'unreachable-required-zone');}
 assert.equal(validateAutoAimZones().ok,false);assert.equal(validateAutoAimZones({origins:[home],zones:[{x:NaN,y:0,width:1,height:1}]}).ok,false);
 assert.equal(validateAutoAimZones({origins:[home],zones:[{x:2001,y:0,width:1,height:1}]}).issues[0].reason,'outside-stage-assist-bounds');
});
test('every player arrow/carrier receives the same assisted vector and projectile-local gravity without damage-stat changes',()=>{
 const ids=Object.keys(SKILLS).filter(id=>!SKILLS[id].summon);assert.equal(ids.length,13);
 for(const id of ids){
  const b=battle(),reference=battle();unlockTestSkills(b);unlockTestSkills(reference);
  b.activeSkill=b.profile.skills.find(s=>s.id===id);reference.activeSkill=reference.profile.skills.find(s=>s.id===id);
  const aim=assistedAutoAim(b.hero.launchPosition,far),plain={...aim,rangeAssisted:false};
  assert.equal(b.shoot(aim),true,id);assert.equal(reference.shoot(plain),true,id);
  const p=b.projectiles.at(-1),q=reference.projectiles.at(-1);near(p.vx,aim.vx);near(p.vy,aim.vy);near(p.gravity,aim.gravity);near(Math.hypot(p.vx,p.vy),22.8);
  assert.equal(q.gravity,.3);for(const key of ['impactDamage','bombDamage','bombRadius','rank','momentum','frostDuration','slowFactor'])assert.equal(p[key],q[key],`${id}.${key}`);
  const gravity=p.gravity;b.applyOptions({shootingMode:'point_aim'});b.shooter.powerPercent=50;assert.equal(p.gravity,gravity);assert.equal(b.gravity,.3);
  assert.equal(b.activeSkill.cooldown,reference.activeSkill.cooldown);
 }
});
test('manual shot modes never inherit range-assist gravity metadata',()=>{
 for(const mode of ['classic','anywhere','point_aim']){const b=battle();b.profile.shootingMode=mode;assert.equal(b.shoot(assistedAutoAim(home,far)),true);assert.equal(b.projectiles.at(-1).gravity,.3);}
});
for(const angleMode of [0,1])test(`assisted ${angleMode?'low':'high'} arc damages a stationary upper-right survivor after keep collapse before any expiry`,()=>{
 const events=[],b=battle({onEvent:e=>events.push(e)});b.enemies.index=b.enemies.roster.length;const target=b.createUnit('air');target.x=far.x;target.y=far.y;target.step=()=>target.effects.step();b.updateGeometry(target);b.badCastle.takeDamage(b.badCastle.hp);
 const hp=target.hp,aim=assistedAutoAim(b.hero.launchPosition,far,{angleMode});assert.equal(b.shoot(aim),true);const arrow=b.projectiles.at(-1);let ticks=0;
 while(arrow.active&&ticks++<500)b.step();for(let i=0;i<6;i++)b.step();
 assert.equal(arrow.reason,'target');assert.ok(target.hp<hp);assert.ok(events.some(e=>e.type==='hit'&&e.target===target));assert.ok(ticks<200);
});
test('assisted paths do not gain launch speed or skip thin body hitboxes between original endpoint/midpoint samples',()=>{
 for(const angleMode of [0,1])for(const target of [{x:1800,y:100},{x:1900,y:300},{x:100,y:0}]){
  const origin=target.x<350?{x:1850,y:600}:home,aim=assistedAutoAim(origin,target,{angleMode});assert.equal(aim.canFire,true);
  const a=new Arrow({...origin,...aim});const victim={hp:100,hitbox:{x:target.x-8,y:target.y-28,width:16,height:56}};let hit=null;
  for(let i=0;i<400&&a.active&&!hit;i++)a.step(()=>{hit=sampleStandardHit(a,2000,[victim]);});assert.equal(hit?.target,victim,JSON.stringify({angleMode,target}));
 }
});

test('actual terrain clearance is checked separately: every sampled stage target has at least one clear low/high path',async()=>{
 const {traceAutoAim}=await import('../site/dist/engine/assisted-auto-aim.mjs');let points=0,blockedArcs=0;
 for(let level=1;level<=30;level++){const b=new CampaignBattle({level}),origin=b.hero.launchPosition;
  for(const x of [100,350,700,1050,1400,1700,1900])for(const offset of [25,310]){
   const target={x,y:b.elevationAt(x)-offset};let clear=false;
   for(const angleMode of [0,1]){const aim=assistedAutoAim(origin,target,{angleMode}),trace=traceAutoAim(origin,target,aim,{elevationAt:x=>b.elevationAt(x)});if(trace.ok)clear=true;else blockedArcs++;}
   assert.equal(clear,true,JSON.stringify({level,target}));points++;
  }
 }assert.equal(points,420);assert.equal(blockedArcs,3,'some low arcs remain terrain-blocked; ballistic reach is not clearance');
 const obstruction={origins:[{x:100,y:500}],zones:[{name:'behind-wall',x:900,y:490,width:10,height:10}],elevationAt:x=>x>400&&x<600?-950:800};
 assert.equal(validateAutoAimZones({...obstruction,elevationAt:null}).ok,true);assert.equal(validateAutoAimZones(obstruction).issues[0].reason,'blocked-or-unreachable-required-zone');
});
test('queued assisted shot freezes its gravity/vector and later power changes cannot retune the airborne arrow',()=>{
 const b=battle(),aim=assistedAutoAim(b.hero.launchPosition,far),skill=b.activeSkill;assert.equal(b.queuePlayerShot(aim,skill),true);
 const captured=b.playerShots[0].aim;assert.ok(Object.isFrozen(captured));aim.gravity=.3;aim.vx=0;b.shooter.powerPercent=50;
 b.step();const arrow=b.projectiles.at(-1);near(arrow.gravity,captured.gravity);near(arrow.vx,captured.vx);near(arrow.vy,captured.vy);
 b.shooter.powerPercent=100;b.step();near(arrow.gravity,captured.gravity);near(arrow.vy,captured.vy+captured.gravity);
});
test('assisted body and critical damage use existing formulas rather than gravity or speed bonuses',()=>{
 for(const critical of [false,true]){
  const run=assisted=>{const b=battle(),aim=assistedAutoAim(home,far);b.shoot({...aim,rangeAssisted:assisted});const p=b.projectiles.at(-1),u=b.createUnit('air');u.x=p.x;u.y=p.y;b.updateGeometry(u);u.getReaction=()=>critical?'critical':'destroy';const hp=u.hp;p.hit(u);for(let i=0;i<6;i++)u.effects.step();return{damage:hp-u.hp,critical:p.critical,base:p.impactDamage};};
  assert.deepEqual(run(true),run(false));
 }
});
test('meteor/comet secondary markers retain ordinary gravity after an assisted carrier impacts',()=>{
 for(const id of ['meteorArrow','cometArrow']){const b=battle();unlockTestSkills(b);b.activeSkill=b.profile.skills.find(s=>s.id===id);const aim=assistedAutoAim(home,far);assert.equal(b.shoot(aim),true);const carrier=b.projectiles.at(-1);near(carrier.gravity,aim.gravity);carrier.impact();
  const secondary=b.projectiles.find(p=>p!==carrier);assert.ok(secondary);assert.equal(secondary.gravity,.3);assert.equal(b.gravity,.3);assert.ok(b.spells.length>0);
 }
});
