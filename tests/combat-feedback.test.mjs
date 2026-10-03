import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {createStatusEffect} from '../site/dist/engine/special-projectiles.mjs';
import {combatNotice,drawCombatNotice,statusBadges,drawStatusBadges} from '../site/dist/combat-feedback.mjs';
import {loadGameUI} from './helpers/game-ui-harness.mjs';

function drawingTrace(){
  const calls=[];
  const ctx=new Proxy({}, {get:(_target,name)=>(...args)=>{
    for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${String(name)} received a non-finite coordinate`);
    calls.push({name,args});
  },set:(target,name,value)=>{target[name]=value;return true;}});
  return {ctx,calls};
}

for(const element of ['fire','ice','bomb','heal']){
  test(`${element} ground-wave engine events produce finite, timed visual feedback`,()=>{
    const events=[],battle=new CampaignBattle({onEvent:event=>events.push(event)});
    battle.queueSpell({kind:`${element}_wave`,x:900,y:battle.elevationAt(900),vx:25,team:'good'});
    battle.step();
    const event=events.find(event=>event.type==='visual'&&event.kind===`${element}-wave`);
    assert.ok(event,'the real spell emitted a wave strike');
    const notice=combatNotice(event);
    assert.ok(notice,'the presenter accepts this previously invisible spell');
    assert.equal(notice.x,event.x);assert.equal(notice.y,event.y);
    assert.equal(notice.life,event.duration);
    const {ctx,calls}=drawingTrace();
    assert.equal(drawCombatNotice(ctx,notice,notice.tick+20),true);
    assert.ok(calls.some(call=>call.name==='fill'||call.name==='stroke'));
    assert.equal(calls.filter(call=>call.name==='save').length,calls.filter(call=>call.name==='restore').length);
    assert.equal(drawCombatNotice(ctx,notice,notice.tick+notice.life),false,'the cue expires on its actual event lifetime');
  });
}

test('healing-wave HP changes reach the presentation event with the actual healed amount',()=>{
  const events=[],battle=new CampaignBattle({onEvent:event=>events.push(event)});
  battle.hero.leaveGarrison();battle.hero.hp=100; // controlled injury fixture
  battle.queueSpell({kind:'heal_wave',x:battle.hero.x,y:battle.hero.y,vx:0,team:'good'});
  for(let i=0;i<25;i++)battle.step();
  const heals=events.filter(event=>event.type==='heal'&&event.target===battle.hero);
  assert.ok(heals.some(event=>event.amount>0));
  assert.equal(heals.reduce((sum,event)=>sum+event.amount,0),battle.hero.hp-100);
  for(const event of heals.filter(event=>event.amount>0)){
    const notice=combatNotice(event),{ctx,calls}=drawingTrace();
    assert.ok(notice);drawCombatNotice(ctx,notice,notice.tick);
    assert.ok(calls.some(call=>call.name==='fillText'&&call.args[0].startsWith('+')));
  }
  assert.equal(combatNotice({type:'heal',target:battle.hero,amount:0,tick:battle.tick}),null);
});

test('status badges follow real effect attachment, expiry and opposite-effect cancellation',()=>{
  const battle=new CampaignBattle(),unit=battle.createUnit('grunt',{team:'good'});
  unit.effects.add(createStatusEffect({kind:'ice',target:unit,duration:2}));
  assert.deepEqual(statusBadges(unit),['ice']);
  const {ctx,calls}=drawingTrace();drawStatusBadges(ctx,unit);assert.ok(calls.length>0);
  unit.effects.step();assert.deepEqual(statusBadges(unit),['ice']);
  unit.effects.step();assert.deepEqual(statusBadges(unit),[]);
  unit.effects.add(createStatusEffect({kind:'ice',target:unit,duration:10}));
  assert.equal(unit.effects.add(createStatusEffect({kind:'fire',target:unit,duration:10})).status,'canceled');
  assert.deepEqual(statusBadges(unit),[]);
  unit.effects.add(createStatusEffect({kind:'poison',target:unit,duration:10}));
  unit.hp=0;assert.deepEqual(statusBadges(unit),[],'dead units have no active-status badge');
});

test('the actual game render consumes ground-wave notices and later removes them',async t=>{
  const ui=await loadGameUI(t);ui.click('start');
  const canvas=ui.get('battlefield');canvas.captureDraws=true;canvas.drawCalls=[];
  const x=900,y=ui.battle.elevationAt(x);
  ui.battle.queueSpell({kind:'ice_wave',x,y,vx:0,team:'good'});
  ui.frames();
  assert.ok(canvas.drawCalls.some(call=>call.name==='translate'&&call.args[0]===x&&call.args[1]===y),'the UI actually draws the emitted wave');
  ui.frames(70);canvas.drawCalls=[];ui.frames();
  assert.equal(canvas.drawCalls.some(call=>call.name==='translate'&&call.args[0]===x&&call.args[1]===y),false,'expired wave marks do not remain on the battlefield');
});
for(const kind of ['meteor','comet'])test(`${kind} impact event reaches the actual renderer at its supplied size and expires`,async t=>{
 const ui=await loadGameUI(t);ui.click('start');const b=ui.battle;b.enemies.step=()=>null;b.friendlyQueue.step=()=>null;const events=[],onEvent=b.onEvent;b.onEvent=e=>{events.push(e);onEvent(e);};const x=1100,y=b.elevationAt(x),p=b.queueProjectile({kind,x,y,vx:0,vy:0});p.impact(null);const event=events.find(e=>e.kind===kind+'-blast');assert.ok(event);const cue=combatNotice(event);assert.equal(cue.radius,event.width/2);assert.equal(cue.life,event.duration);
 const {ctx,calls}=drawingTrace();drawCombatNotice(ctx,cue,cue.tick+2);assert.ok(calls.some(c=>c.name==='arc'));assert.equal(drawCombatNotice(ctx,cue,cue.tick+cue.life),false);
 const canvas=ui.get('battlefield');canvas.captureDraws=true;canvas.drawCalls=[];ui.frames();assert.ok(canvas.drawCalls.some(c=>c.name==='translate'&&c.args[0]===x&&c.args[1]===y));ui.frames(cue.life+2);canvas.drawCalls=[];ui.frames();assert.equal(canvas.drawCalls.some(c=>c.name==='translate'&&c.args[0]===x&&c.args[1]===y),false);
});
