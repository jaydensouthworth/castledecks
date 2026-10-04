import test from 'node:test';import assert from 'node:assert/strict';import {createCanvas} from '@napi-rs/canvas';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {drawFortification,fortificationGeometry,fortificationFooting,garrisonStation} from '../site/dist/fortress-art.mjs';
import {combatPose,personRig} from '../site/dist/combat-poses.mjs';
import {createWorldCamera,worldToScreen} from '../site/dist/world-camera.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fixture(level=1){return new CampaignBattle({level,random:()=>.5});}

test('all 60 campaign keeps have continuous support to their actual uphill/downhill terrain',()=>{
 for(let level=1;level<=30;level++){
  const b=fixture(level);
  for(const building of [b.goodCastle,b.badCastle]){
   const g=fortificationGeometry(building),f=fortificationFooting(building,{elevationAt:x=>b.elevationAt(x)});
   const canvas=createCanvas(400,400),ctx=canvas.getContext('2d');ctx.translate(200-building.x,300-building.y);
   drawFortification(ctx,building,{elevationAt:x=>b.elevationAt(x)});
   for(let x=g.body.x+2;x<g.body.x+g.body.width-2;x+=3){
    const bottom=b.elevationAt(x);
    for(let y=f.top-1;y<bottom-1;y+=2){const alpha=ctx.getImageData(Math.round(x-building.x+200),Math.round(y-building.y+300),1,1).data[3];assert.ok(alpha>230,`level ${level} ${building.team}: gap at ${x},${y}`);}
   }
   for(const [x,y] of f.ground)near(y,b.elevationAt(x));
  }
 }
});

test('ground support changes with slope without moving the damageable rectangle',()=>{
 const b=fixture(),keep=b.goodCastle,box={...keep.hitbox};
 for(const slope of [-.65,.65]){const elevationAt=x=>keep.y+(x-keep.x)*slope;
  const f=fortificationFooting(keep,{elevationAt});
  for(const [x,y] of f.ground)near(y,elevationAt(x));
  assert.deepEqual(fortificationGeometry(keep).hitbox,box);assert.deepEqual(keep.hitbox,box);
 }
});

test('tower footings follow slopes even though their live collider extends underground',()=>{
 const b=fixture(17),tower=b.createTower(1000),g=fortificationGeometry(tower),f=fortificationFooting(tower,{elevationAt:x=>b.elevationAt(x)});
 assert.ok(g.hitbox.y+g.hitbox.height>tower.y);assert.ok(f.ground.some(([,y])=>y>tower.y));
 for(const [x,y]of f.ground)near(y,b.elevationAt(x));
});

test('hero feet sit exactly on the gallery while launch position is untouched in both facings',()=>{
 const b=fixture(17);
 for(const building of [b.goodCastle,b.badCastle,b.createTower(1000)])for(const facing of [-1,1]){
  b.hero.leaveGarrison();building.occupiedBy='neutral';assert.equal(b.hero.garrisonInto(building),true);b.hero.facing=facing;
  const before={...b.hero.launchPosition},station=garrisonStation(building),rig=personRig(combatPose(b.hero),55);
  for(const leg of rig.legs){near(station.hero.y+leg.foot.y,station.floor.y);const footX=station.hero.x+leg.foot.x*facing;assert.ok(footX>=station.floor.x&&footX<=station.floor.x+station.floor.width);}
  assert.deepEqual(b.hero.launchPosition,before);assert.deepEqual(station.launch,before);
 }
});

test('leaving and reentering garrison preserves actual terrain and normal launch offsets',()=>{
 const b=fixture(7),hero=b.hero,before={...hero.launchPosition};hero.leaveGarrison();b.input={down:true};hero.step();near(hero.y,b.elevationAt(hero.x));near(hero.launchPosition.y,hero.y-30);hero.attemptGarrison();assert.equal(hero.garrisonBuilding,b.goodCastle);assert.deepEqual(hero.launchPosition,before);
});

test('gallery contact stays exact through desktop, landscape and portrait projection',()=>{
 const b=fixture(),s=garrisonStation(b.goodCastle);
 for(const [w,h] of [[1280,720],[915,360],[412,780]]){const camera=createWorldCamera(w,h),feet=worldToScreen(camera,{x:s.hero.x,y:s.hero.y-2}),ledge=worldToScreen(camera,{x:s.hero.x,y:s.floor.y});near(feet.x,ledge.x);near(feet.y,ledge.y);}
});

test('terrain-aware rendering cannot alter garrison, launch, hitbox, HP or ownership',()=>{
 const b=fixture(17),c=b.goodCastle,canvas=createCanvas(400,400),ctx=canvas.getContext('2d');
 const state=()=>JSON.stringify({x:c.x,y:c.y,hp:c.hp,hitbox:c.hitbox,occupiedBy:c.occupiedBy,hero:{x:b.hero.x,y:b.hero.y,visible:b.hero.visible,launch:b.hero.launchPosition},occupants:c.occupants.length});
 const before=state();drawFortification(ctx,c,{elevationAt:x=>b.elevationAt(x),tick:13});garrisonStation(c);assert.equal(state(),before);
});
