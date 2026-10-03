/** Regression checks for the removed-unit garrison cleanup. These failed against
 * V20 retained dead occupants and pass after the removeUnit cleanup.
 * Controlled setup uses real units/effects; no original-game parity is claimed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {FirstBattle} from '../site/dist/engine/first-battle.mjs';
import {createStatusEffect} from '../site/dist/engine/special-projectiles.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
function fixture(){
 const b=new FirstBattle({random:seededRandom(112)});
 b.enemies.step=()=>null;b.friendlyQueue.step=()=>null;b.hero.leaveGarrison();
 return b;
}
function dyingArcher(b,building,team='good'){
 const unit=b.createUnit('archer',{team});unit.x=building.x;unit.y=building.y;unit.hp=1;
 assert.equal(unit.effects.add(createStatusEffect({kind:'poison',target:unit,duration:100,sickness:10},{random:()=>.5})).status,'accepted');
 assert.equal(unit.attemptGarrison(building),true);return unit;
}
const advance=(b,count=200)=>{for(let i=0;i<count;i++)b.step();};
test('four archers dying inside the keep release capacity for the hero',()=>{
 const b=fixture(),units=Array.from({length:4},()=>dyingArcher(b,b.goodCastle));
 assert.equal(b.goodCastle.hasRoom(),false);advance(b);
 assert.ok(units.every(u=>u.destroyed&&!b.objects.items.includes(u)&&!b.goodTeam.includes(u)));
 assert.equal(b.goodCastle.occupants.length,0,'removed corpses must release their occupied slots');
 assert.ok(units.every(u=>u.garrisonBuilding===null));assert.equal(b.goodCastle.hasRoom(),true);
 assert.equal(b.hero.garrisonInto(b.goodCastle),true);
});
test('a real poison-arrow status can kill an archer after it enters a keep',()=>{
 const b=fixture();b.hero.x=1600;b.hero.y=b.elevationAt(1600);
 const unit=b.createUnit('archer',{team:'bad'});unit.x=b.badCastle.x;unit.y=b.badCastle.y;unit.transition('advance');
 const arrow=b.queueProjectile({kind:'poison_arrow',team:'good',source:b.hero,owner:b.hero,x:unit.x,y:unit.y-20,vx:0,vy:0});
 arrow.impact(unit);unit.effects.step();assert.ok(unit.hp>0&&unit.hp<unit.maxHp);
 assert.ok(unit.effects.effects.some(e=>e.kind==='poison'));
 assert.equal(unit.attemptGarrison(b.badCastle),true);advance(b,300);
 assert.equal(unit.destroyed,true);assert.equal(b.badCastle.occupants.includes(unit),false);
 assert.equal(unit.garrisonBuilding,null);
});
test('removing one dead garrisoned archer keeps surviving occupants and owner',()=>{
 const b=fixture();const survivor=b.createUnit('archer',{team:'good'});survivor.x=b.goodCastle.x;survivor.y=b.goodCastle.y;
 // A stationary load cycle lasts beyond this bounded death/removal observation.
 survivor.transition('aim');survivor.actionDuration=1000;assert.equal(survivor.attemptGarrison(b.goodCastle),true);
 const dead=dyingArcher(b,b.goodCastle);advance(b);
 assert.equal(dead.destroyed,true);assert.deepEqual(b.goodCastle.occupants,[survivor]);
 assert.equal(survivor.garrisonBuilding,b.goodCastle);assert.equal(b.goodCastle.occupiedBy,'good');
});
test('the existing tower leave path handles dead occupants without changing its stale affiliation rule',()=>{
 const b=fixture(),tower=b.createTower(700),dead=dyingArcher(b,tower);advance(b);
 assert.equal(dead.destroyed,true);assert.equal(tower.occupants.length,0);assert.equal(dead.garrisonBuilding,null);
 assert.equal(tower.occupiedBy,'neutral');assert.equal(tower.hasRoom(),true);
 assert.equal(b.neutralStructures.includes(tower),true);
 assert.equal(b.goodStructures.includes(tower),true,'documented stale affiliation is retained');
});
test('a destroyed building can release its occupant before unit removal without duplicate cleanup',()=>{
 const b=fixture(),unit=dyingArcher(b,b.goodCastle);b.goodCastle.takeDamage(b.goodCastle.hp);advance(b);
 assert.equal(unit.destroyed,true);assert.equal(unit.garrisonBuilding,null);assert.equal(b.goodCastle.occupants.length,0);
});
