import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {FirstBattle} from '../site/dist/engine/first-battle.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {createWorldCamera,worldToScreen,screenToWorld} from '../site/dist/world-camera.mjs';
import {drawFortification,drawFortificationCollision,fortificationGeometry} from '../site/dist/fortress-art.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const battle=(level=1)=>new FirstBattle({level,random:seededRandom(3441)});

function probe({side,edge,delta=0,kind='hero_arrow',level=1}){
 const b=battle(level),target=side==='good'?b.goodCastle:b.badCastle,h=target.hitbox;
 const p={x:h.x+h.width/2,y:h.y+h.height/2,vx:0,vy:0};
 if(edge==='left'){p.x=h.x+delta;p.vx=8;}
 if(edge==='right'){p.x=h.x+h.width-delta;p.vx=-8;}
 if(edge==='top'){p.y=h.y+delta;p.vx=8;}
 if(edge==='bottom'){p.y=h.y+h.height-delta;p.vx=8;}
 const impacts=[],events=[],queue=b.queueImpact.bind(b);b.queueImpact=r=>{impacts.push(r);return queue(r);};b.onEvent=e=>events.push(e);
 const shot=b.queueProjectile({kind,team:side==='good'?'bad':'good',source:b.hero,owner:b.hero,x:p.x-2*p.vx,y:p.y,vx:p.vx,vy:0,gravity:0});
 shot.step();target.effects.step();
 return {hit:impacts.some(r=>r.target===target)||events.some(e=>e.type==='projectile-hit'&&e.target===target),shot,target,p,impacts};
}

for(const side of ['good','bad'])for(const kind of ['hero_arrow','standard_arrow','fire_arrow','pierce_arrow','trebuchet_ammo']){
 test(`${side} ${kind}: all four live castle boundaries accept inside and reject outside trajectories`,()=>{
  for(const edge of ['left','right','top','bottom']){
   assert.equal(probe({side,kind,edge,delta:.01}).hit,true,`${edge} inside`);
   assert.equal(probe({side,kind,edge,delta:-.01}).hit,false,`${edge} outside`);
   assert.equal(probe({side,kind,edge,delta:0}).hit,true,`${edge} exact inclusive edge`);
  }
 });
}

test('real standard arrow midpoint sampling still catches a crossed narrow edge',()=>{
 const b=battle(),target=b.badCastle,h=target.hitbox,impacts=[];b.queueImpact=r=>impacts.push(r);
 const finalX=h.x+h.width+2,vx=12;
 const p=b.queueProjectile({kind:'standard_arrow',team:'good',x:finalX-vx*2,y:h.y+50,vx,vy:0,gravity:0});p.step();
 assert.ok(p.x>h.x+h.width);assert.ok(p.midpoint.x<h.x+h.width);assert.equal(impacts[0]?.target,target);
});

test('all campaign castles use the exact live rectangle for their full solid masonry',()=>{
 for(let level=1;level<=30;level++)for(const building of [battle(level).goodCastle,battle(level).badCastle]){
  const g=fortificationGeometry(building);assert.deepEqual(g.hitbox,building.hitbox);assert.deepEqual(g.body,building.hitbox);
  near(g.foundation.y+g.foundation.height,building.y);
 }
});

test('tower overlay retains its underground engine bounds while stone stops at ground',()=>{
 const b=battle(),tower=b.createTower(1000),g=fortificationGeometry(tower);
 assert.deepEqual(g.hitbox,tower.hitbox);near(g.body.y+g.body.height,tower.y);assert.ok(g.hitbox.y+g.hitbox.height>tower.y+64);
 const p=b.queueProjectile({kind:'hero_arrow',team:'good',source:b.hero,x:tower.x,y:tower.y+10,vx:0,vy:0,gravity:0});p.step();
 assert.equal(p.reason,'ground');assert.equal(tower.hp,tower.maxHp);
});

function drawAtOrigin(renderer,building){const canvas=createCanvas(300,360),ctx=canvas.getContext('2d');ctx.translate(150-building.x,290-building.y);renderer(ctx,building);return{canvas,ctx,alpha:(dx,dy)=>ctx.getImageData(Math.round(150+dx),Math.round(290+dy),1,1).data[3]};}

test('visible target area is opaque at old empty-roof and outer-edge miss locations',()=>{
 const b=battle();
 for(const building of [b.goodCastle,b.badCastle]){
  const h=building.hitbox,n=drawAtOrigin(drawFortification,building);
  for(let x=h.x+1;x<h.x+h.width-1;x+=2)for(let y=h.y+1;y<h.y+h.height-1;y+=2){assert.ok(n.alpha(x-building.x,y-building.y)>245,`hole at ${x}, ${y}`);}
 }
 const next=drawAtOrigin(drawFortification,b.badCastle);
 assert.ok(next.alpha(18,-188)>245);
 // Old right tower was solid-looking outside the target. New stone stops at the edge.
 assert.equal(next.alpha(66,-100),0);
});

test('friendly doors and windows retain their native shape without anisotropic transforms',()=>{
 const b=battle();
 for(const building of [b.goodCastle,b.badCastle,b.createTower(1000)]){
  const canvas=createCanvas(300,360),ctx=canvas.getContext('2d'),scales=[];
  const orig=ctx.scale.bind(ctx);ctx.scale=(x,y)=>{scales.push([x,y]);orig(x,y);};
  drawFortification(ctx,building,{scale:.18});
  assert.deepEqual(scales,[]);
 }
});

test('camera projects drawing and collision identically in phone portrait and landscape',()=>{
 const b=battle();
 for(const [w,h] of [[384,824],[824,384],[915,412],[2000,1000]]){
  const c=createWorldCamera(w,h);
  for(const building of [b.goodCastle,b.badCastle]){
   const g=fortificationGeometry(building),tl=worldToScreen(c,g.body),br=worldToScreen(c,{x:g.body.x+g.body.width,y:g.body.y+g.body.height});
   near((br.x-tl.x)/(br.y-tl.y),g.body.width/g.body.height);
   const point=screenToWorld(c,tl);near(point.x,building.hitbox.x);near(point.y,building.hitbox.y);
  }
 }
});

test('overlay draws live bounds, restores canvas, and omits destroyed or absent collisions',()=>{
 const b=battle(),calls=[],stack=[];let state={strokeStyle:'#123456',lineWidth:7,lineDash:[1,2]};
 const ctx=new Proxy({}, {get:(_,key)=>key==='save'?()=>stack.push({...state}):key==='restore'?()=>{state=stack.pop();}:key==='setLineDash'?value=>{state.lineDash=value;}:key==='strokeRect'?(...args)=>calls.push(args):key in state?state[key]:(...args)=>{},set:(_,key,value)=>{state[key]=value;return true;}});
 const before={...state};
 assert.equal(drawFortificationCollision(ctx,b.badCastle,{scale:.192,labels:false}),true);
 assert.deepEqual(calls,[Object.values(b.badCastle.hitbox)]);
 assert.deepEqual(state,before);assert.equal(stack.length,0);
 const hp=b.badCastle.hp;b.badCastle.takeDamage(hp);assert.equal(drawFortificationCollision(ctx,b.badCastle),false);
 assert.equal(drawFortificationCollision(ctx,{x:1,y:1}),false);assert.equal(calls.length,1);
});

test('piercing arrows stop on castle without invented structure damage',()=>{
 for(const side of ['good','bad']){const p=probe({side,edge:'left',delta:1,kind:'pierce_arrow'});assert.equal(p.hit,true);assert.equal(p.shot.active,false);assert.equal(p.target.hp,p.target.maxHp);assert.equal(p.impacts.length,0);}
});

test('art and overlay leave live gameplay state unchanged across health and destruction states',()=>{
 const b=battle(),ctx=createCanvas(600,600).getContext('2d');
 for(const building of [b.goodCastle,b.badCastle,b.createTower(1000)])for(const state of ['healthy','damaged','destroyed']){
  if(state==='damaged')building.hp=building.maxHp*.25;
  if(state==='destroyed')building.takeDamage(building.hp);
  const before={x:building.x,y:building.y,hp:building.hp,maxHp:building.maxHp,hitbox:building.hitbox&&{...building.hitbox},width:building.width,height:building.height,occupiedBy:building.occupiedBy,destroyed:building.destroyed};
  assert.equal(drawFortification(ctx,building,{scale:.18,tick:100}),true);drawFortificationCollision(ctx,building,{scale:.18});
  assert.deepEqual({x:building.x,y:building.y,hp:building.hp,maxHp:building.maxHp,hitbox:building.hitbox&&{...building.hitbox},width:building.width,height:building.height,occupiedBy:building.occupiedBy,destroyed:building.destroyed},before);
 }
});
