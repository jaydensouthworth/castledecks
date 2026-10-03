import test from 'node:test';import assert from 'node:assert/strict';
import {hostileTowerOccupantCount,shelteredEnemyCount} from '../site/dist/garrison-intel.mjs';
import {drawFortification,drawHostileTowerOccupants,fortificationGeometry} from '../site/dist/fortress-art.mjs';
import {enemyHudProgress} from '../site/dist/combat-hud.mjs';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';
function fixture(team='bad',count=2){const b=new CampaignBattle({level:29,random:seededRandom(42)}),tower=b.createTower(1300);const units=Array.from({length:count},()=>{const u=b.createUnit('archer',{team});u.x=tower.x;u.y=tower.y;u.transition('aim');assert.ok(u.attemptGarrison(tower));return u;});return {b,tower,units};}
function trace(){const calls=[];const ctx=new Proxy({},{get:(_,name)=>(...args)=>{for(const x of args)if(typeof x==='number')assert.ok(Number.isFinite(x));calls.push({name,args});},set:()=>true});return {ctx,calls};}

test('counts actual living hostile tower occupants, excluding corpses, other teams and stale references',()=>{
 const {b,tower,units}=fixture();assert.equal(hostileTowerOccupantCount(tower),2);assert.equal(shelteredEnemyCount(b),2);
 units[0].hp=0;assert.equal(hostileTowerOccupantCount(tower),1);units[0].hp=100;units[0].dead=true;assert.equal(hostileTowerOccupantCount(tower),1);units[0].dead=false;units[0].destroyed=true;assert.equal(hostileTowerOccupantCount(tower),1);units[0].destroyed=false;
 units[0].garrisonBuilding=null;assert.equal(hostileTowerOccupantCount(tower),1);units[0].garrisonBuilding=tower;units[0].team='good';assert.equal(hostileTowerOccupantCount(tower),1);
 assert.equal(hostileTowerOccupantCount(fixture('good').tower),0);
});

test('destroyed, empty, neutral or non-tower shelters cannot display an occupant badge',()=>{
 for(const change of [t=>t.hp=0,t=>t.destroyed=true,t=>t.clipPresent=false,t=>t.occupiedBy='neutral',t=>t.type='castle',t=>t.occupants=[]]){const {tower}=fixture();change(tower);assert.equal(hostileTowerOccupantCount(tower),0);assert.equal(drawHostileTowerOccupants(trace().ctx,tower),false);}
 assert.equal(hostileTowerOccupantCount(null),0);assert.equal(shelteredEnemyCount(null),0);
});

test('duplicate references cannot inflate current occupant or sheltered counts',()=>{
 const {b,tower,units}=fixture();tower.occupants.push(units[0]);b.badTeam.push(units[0]);assert.equal(hostileTowerOccupantCount(tower),2);assert.equal(shelteredEnemyCount(b),2);
});

test('badge width and typography stay in CSS pixels above the flag and clear of the tower body',()=>{
 const {tower}=fixture(),g=fortificationGeometry(tower);
 for(const scale of [.18,.5,1,2,NaN]){const {ctx,calls}=trace();assert.equal(drawHostileTowerOccupants(ctx,tower,{scale}),true);const s=Number.isFinite(scale)?scale:1;
  assert.ok(calls.some(c=>c.name==='scale'&&c.args[0]===1/s&&c.args[1]===1/s));assert.ok(calls.some(c=>c.name==='translate'&&c.args[0]===g.centerX&&c.args[1]===g.body.y-38));
  assert.ok(calls.some(c=>c.name==='fillRect'&&c.args[2]===64&&c.args[3]===18));assert.ok(calls.some(c=>c.name==='fillText'&&c.args[0]==='2 inside'));
  assert.ok(g.body.y-38-4/s<g.body.y,'badge bottom never covers shootable stone');assert.equal(calls.filter(c=>c.name==='save').length,calls.filter(c=>c.name==='restore').length);
 }
});

test('ordinary fortification rendering includes the badge without modifying frozen actor or building data',()=>{
 const {tower,units}=fixture();const before={hp:tower.hp,owner:tower.occupiedBy,x:tower.x,y:tower.y,unitHp:units.map(u=>u.hp),unitGarrison:units.map(u=>u.garrisonBuilding)};
 Object.freeze(tower.occupants);units.forEach(Object.freeze);Object.freeze(tower);
 const {ctx,calls}=trace();drawFortification(ctx,tower,{scale:.3,tick:300});assert.ok(calls.some(c=>c.name==='fillText'&&c.args[0]==='2 inside'));
 assert.deepEqual({hp:tower.hp,owner:tower.occupiedBy,x:tower.x,y:tower.y,unitHp:units.map(u=>u.hp),unitGarrison:units.map(u=>u.garrisonBuilding)},before);
});

test('final stand explicitly identifies tower-only survivors, retaining all normal counts and outcomes',()=>{
 const {b,tower,units}=fixture();assert.match(enemyHudProgress(b),/^2 enemies/);b.badCastle.takeDamage(b.badCastle.hp);assert.equal(b.outcome,null);assert.equal(enemyHudProgress(b),'Final stand · 2 in towers');
 const field=b.createUnit('grunt');assert.equal(enemyHudProgress(b),'Final stand · 3 enemies');field.hp=0;assert.equal(enemyHudProgress(b),'Final stand · 2 in towers');
 units[0].hp=0;assert.equal(enemyHudProgress(b),'Final stand · 1 in towers');tower.takeDamage(tower.hp);assert.equal(enemyHudProgress(b),'Final stand · 1 enemy','destroyed shelter never masks a remaining actor');
 assert.equal(b.outcome,null,'presentation cannot settle the real remaining enemy');
});

test('actual tower destruction releases hidden archers under normal lifecycle and removes the cue',()=>{
 const {b,tower,units}=fixture();tower.takeDamage(tower.hp);for(let i=0;i<5;i++)b.step();assert.ok(units.every(u=>u.garrisonBuilding===null&&u.visible&&u.canGetHit));assert.equal(hostileTowerOccupantCount(tower),0);
});

test('current full UI draws the occupied-tower label and identifies final sheltered survivors',async t=>{
 const ui=await loadGameUI(t);ui.click('start');const b=ui.battle;b.enemies.step=()=>null;b.friendlyQueue.step=()=>null;
 const tower=b.createTower(1200);for(let i=0;i<2;i++){const u=b.createUnit('archer');u.x=tower.x;u.y=tower.y;u.transition('aim');assert.ok(u.attemptGarrison(tower));}
 b.badCastle.takeDamage(b.badCastle.hp);const canvas=ui.get('battlefield');canvas.captureDraws=true;canvas.drawCalls=[];ui.frames();
 assert.ok(canvas.drawCalls.some(c=>c.name==='fillText'&&c.args[0]==='2 inside'));assert.equal(ui.get('combatEnemyState').textContent,'Final stand · 2 in towers');
 assert.equal(b.outcome,null);assert.ok(b.badTeam.every(u=>u.hp>0&&!u.visible));
});
