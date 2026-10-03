/** Player-reported phantom-attacker regression. The primary fixture uses normal
 * hero HP/input and normal enemy spawn points; only roster/spawn timing is
 * controlled. Recovery fixtures explicitly simulate an existing invalid actor.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
const dist=process.env.BOWMASTER_TEST_DIST??new URL('../site/dist/',import.meta.url).href;
const {FirstBattle}=await import(new URL('engine/first-battle.mjs',dist));
const {seededRandom}=await import(new URL('engine/combat.mjs',dist));
function quiet(level=14,random=()=>.5){const b=new FirstBattle({level,random});b.enemies.step=()=>null;b.friendlyQueue.step=()=>null;b.hero.leaveGarrison();return b;}
function run(b,n){for(let i=0;i<n;i++)b.step();}
const groundTypes=['grunt','tallGrunt','archer','priest','mount','trebuchet','fireDemon','iceDemon','gorath'];
function enemy(b,type){return b.createUnit(type);}
function traceHeroImpacts(b){const trace=[],q=b.queueImpact.bind(b);b.queueImpact=r=>{if(r.target===b.hero)trace.push({tick:b.tick,source:r.source,x:r.source?.x,y:r.source?.y,distance:r.source?.distanceTo?.(b.hero)});return q(r);};return trace;}
for(const level of [1,8,14,30])test(`Battle ${level}: walking to enemy wall and back cannot retain an invisible priest attacker`,()=>{
 const b=quiet(level),trace=traceHeroImpacts(b);b.input.right=true;run(b,1300);b.input.right=false;assert.ok(b.hero.x>1990&&b.hero.x<2000);
 const priests=[enemy(b,'priest'),enemy(b,'priest')];assert.ok(priests.every(u=>u.x===2050));run(b,180);
 assert.ok(priests.every(u=>Number.isFinite(u.y)));assert.ok(priests.every(u=>u.x>=0&&u.x<2000));
 b.input.left=true;run(b,600);b.input.left=false;
 assert.equal(b.outcome,null);assert.ok(b.hero.hp>0);assert.ok(b.hero.x<1100);assert.ok(trace.length>0,'valid nearby attacks remain enabled');
 assert.ok(trace.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&e.distance<=45),'all melee impacts must be from real nearby attackers');
 assert.ok(priests.every(u=>u.hp>0&&!u.destroyed&&Number.isFinite(u.y)));assert.equal(b.badTeam.length,2);assert.equal(b.profile.defeats,0);assert.equal(b.profile.victories,0);
 const hp=b.hero.hp;run(b,150);assert.equal(b.hero.hp,hp,'out-of-range priest must stop hitting after hero moves away');
});
for(const type of groundTypes)for(const side of ['left','right'])test(`${type}: ${side} boundary and existing invalid-position recovery preserve actor life`,()=>{
 const b=quiet(),u=enemy(b,type),hp=u.hp,gold=b.profile.gold,xp=b.profile.xp;u.x=side==='left'?.1:1999.9;u.y=b.elevationAt(u.x);u.vx=side==='left'?-2:2;u.actionDuration=1000;
 u.step();assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y));assert.ok(u.x>=0&&u.x<2000);assert.equal(u.vx,0);assert.equal(u.hp,hp);
 // An already-corrupted live unit from an older run must become hittable again.
 u.x=side==='left'?-10:2010;u.y=NaN;u.vx=0;u.actionDuration=1000;u.step();b.updateGeometry(u);
 assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y));assert.ok(u.x>=0&&u.x<2000);assert.ok(Object.values(u.hitbox).every(Number.isFinite));
 assert.equal(u.hp,hp);assert.equal(u.destroyed,false);assert.equal(b.badTeam.includes(u),true);assert.equal(b.profile.gold,gold);assert.equal(b.profile.xp,xp);assert.equal(b.outcome,null);
 u.takeDamage(u.hp);run(b,300);assert.equal(u.destroyed,true,'recovered unit remains killable through ordinary lifecycle');assert.equal(b.badTeam.includes(u),false);
});
for(const type of groundTypes.filter(t=>t!=='gorath'))for(const team of ['good','bad'])test(`${team} ${type}: initial off-screen ingress stays finite and reaches playable terrain`,()=>{
 const b=quiet(),u=b.createUnit(type,{team});const start=u.x;assert.equal(start,team==='good'?-50:2050);u.step();assert.ok(Number.isFinite(u.y));assert.ok(team==='good'?u.x<0:u.x>2000,'first ingress step is not teleported onto field');
 // Normal actions, not forced velocity, govern the remaining ingress.
 run(b,250);assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y));assert.ok(u.x>=0&&u.x<2000);assert.equal(u.destroyed,false);
});
for(const type of ['grunt','tallGrunt','archer','priest','mount','fireDemon','iceDemon','trebuchet'])test(`${type}: a non-finite linked melee distance fails closed before damage`,()=>{
 const b=quiet(),u=enemy(b,type);b.hero.x=700;b.hero.y=b.elevationAt(700);u.x=2010;u.y=NaN;u.linkTarget(b.hero);const trace=traceHeroImpacts(b);u.attackEngagementTarget();assert.equal(trace.length,0);assert.equal(u.attacking.includes(b.hero),false);assert.equal(b.hero.attackedBy.includes(u),false);
});
test('moving past a priest in the interior releases its ordinary engagement',()=>{const b=quiet(),u=enemy(b,'priest'),trace=traceHeroImpacts(b);b.hero.x=1000;b.hero.y=b.elevationAt(1000);u.x=1010;u.y=b.elevationAt(1010);u.chooseNextAction();run(b,50);b.input.left=true;run(b,300);b.input.left=false;assert.ok(trace.every(e=>Number.isFinite(e.distance)&&e.distance<=45));assert.ok(b.hero.hp>0);const hp=b.hero.hp;run(b,50);assert.equal(b.hero.hp,hp);});
test('pause/resume around priest edge chase preserves finite state and attack ranges',()=>{const b=quiet(),trace=traceHeroImpacts(b);b.hero.x=1999;b.hero.y=b.elevationAt(1999);const u=enemy(b,'priest');run(b,90);b.paused=true;const state={x:u.x,y:u.y,hp:b.hero.hp,tick:b.tick};run(b,300);assert.deepEqual({x:u.x,y:u.y,hp:b.hero.hp,tick:b.tick},state);b.paused=false;b.input.left=true;run(b,450);assert.ok(Number.isFinite(u.y));assert.ok(trace.every(e=>Number.isFinite(e.distance)&&e.distance<=45));});
test('garrison after escape breaks priest engagement without retaining hidden damage',()=>{const b=quiet(),u=enemy(b,'priest');b.hero.x=1999;b.hero.y=b.elevationAt(1999);run(b,160);b.input.left=true;run(b,1032);b.input.left=false;b.hero.attemptGarrison();assert.equal(b.hero.garrisoned(),true);const hp=b.hero.hp;run(b,500);assert.equal(b.hero.hp,hp);assert.equal(u.attacking.includes(b.hero),false);});
test('boss ingress and aerial patrol retain separate movement paths',()=>{const b=quiet(),boss=enemy(b,'gorath'),flyer=enemy(b,'air');const air={x:flyer.x,y:flyer.y,vx:flyer.vx,vy:flyer.vy};run(b,1);assert.ok(boss.x>=2200&&Number.isFinite(boss.y),'boss keeps its first off-screen setup step');assert.ok(Number.isFinite(flyer.y));assert.equal(Object.hasOwn(flyer,'enteredGroundField'),false);assert.notEqual(flyer.x,air.x);});
for(const side of ['left','right'])for(const kind of ['bomb_arrow','bomb_wave_arrow','trebuchet_ammo'])test(`${kind}: ${side}-edge impact reactions cannot strand a ground unit`,()=>{
 const b=quiet(14,()=>0),u=enemy(b,'tallGrunt');u.x=side==='left'?.2:1999.8;u.y=b.elevationAt(u.x);u.vx=0;u.actionDuration=1000;const before={x:u.x,hp:u.hp};
 const p=b.queueProjectile({kind,source:b.hero,owner:b.hero,team:'good',rank:0,x:u.x,y:u.y-20,vx:0,vy:0,impactDamage:150});p.impact(kind==='bomb_wave_arrow'?null:u);run(b,1);
 assert.ok(u.hp<before.hp||b.spells.length>0);assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y));assert.equal(u.x,before.x,'the current knockback/flinch animation must not invent a physical shove');
 run(b,500);assert.ok(u.destroyed||(Number.isFinite(u.x)&&Number.isFinite(u.y)&&u.x>=0&&u.x<2000));
});
test('companion shockwave daze at map edge remains finite and recovers normally',async()=>{const {CompanionShockWave}=await import(new URL('engine/companions.mjs',dist));const b=quiet(),u=enemy(b,'tallGrunt');u.x=1999;u.y=b.elevationAt(1999);u.vx=0;u.actionDuration=1000;const source={team:'good',x:1919,y:b.elevationAt(1919),forward:1};b.addSpell(new CompanionShockWave({source,world:b,damage:100}));run(b,100);assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y));assert.ok(u.x<2000);run(b,500);assert.ok(u.destroyed||(Number.isFinite(u.x)&&Number.isFinite(u.y)));});
