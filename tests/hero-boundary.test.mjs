import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {HeightField} from '../site/dist/engine/terrain.mjs';

function finiteHero(battle){
  const hero=battle.hero,launch=hero.launchPosition;
  assert.ok([hero.x,hero.y,launch.x,launch.y].every(Number.isFinite));
  assert.ok(hero.x>=0&&hero.x<2000);
  assert.equal(hero.y,battle.elevationAt(hero.x));
}

for(const direction of ['left','right']){
  test(`holding ${direction} at the map edge cannot lose the hero or corrupt its shot`,()=>{
    const battle=new CampaignBattle();
    battle.input[direction]=true;
    for(let i=0;i<(direction==='left'?300:1100);i++)battle.step();
    assert.equal(battle.outcome,null,'the movement repro reaches the edge before an outcome');
    assert.equal(battle.hero.garrisoned(),false);
    finiteHero(battle);
    const edgeX=battle.hero.x;
    for(let i=0;i<30;i++)battle.step();
    assert.equal(battle.hero.x,edgeX,'continued input stays at the last finite terrain point');
    battle.input[direction]=false;
    const back=direction==='left'?'right':'left';battle.input[back]=true;
    battle.step();finiteHero(battle);
    assert.ok(direction==='left'?battle.hero.x>edgeX:battle.hero.x<edgeX,'the hero can walk back immediately');
    battle.input[back]=false;
    assert.equal(battle.shoot({canFire:true,vx:direction==='left'?18:-18,vy:-8}),true);
    const arrow=battle.projectiles.at(-1);
    assert.ok([arrow.x,arrow.y,arrow.vx,arrow.vy].every(Number.isFinite));
  });
}

test('invalid player vectors are rejected without spending a cooldown or retaining NaN objects',()=>{
  const battle=new CampaignBattle();
  for(let i=0;i<31;i++)battle.step();
  const skill=battle.activeSkill,count=battle.objects.items.length;
  for(const [vx,vy] of [[NaN,10],[10,NaN],[Infinity,10],[10,-Infinity]]){
    assert.equal(battle.shoot({canFire:true,vx,vy}),false);
    assert.equal(skill.cooldown,0);
    assert.equal(battle.projectiles.length,0);
    assert.equal(battle.objects.items.length,count);
    assert.equal(battle.stats.shotsFired,0);
  }
  assert.equal(battle.shoot({canFire:true,vx:18,vy:-8}),true);
  assert.equal(battle.stats.shotsFired,1);
});

test('player guard does not clamp the shared terrain sampler for enemy or spell code',()=>{
  const terrain=new HeightField();
  assert.ok(Number.isNaN(terrain.elevationAt(-1)));
  assert.ok(Number.isNaN(terrain.elevationAt(2000)));
  assert.ok(Number.isFinite(terrain.elevationAt(1999)));
});
