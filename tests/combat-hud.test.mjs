import test from 'node:test';
import assert from 'node:assert/strict';
import {combatHudState,updateCombatHud} from '../site/dist/combat-hud.mjs';
const mock=(mode='classic')=>({level:17,profile:{shootingMode:mode},hero:{garrisoned:()=>true},activeSkill:{id:'arrow',cooldown:0},badTeam:[{hp:10},{hp:20}],enemies:{remaining:34},activationObjects:[]});
test('all real aiming modes describe their actual input',()=>{
 const hints={classic:/Pull from your hero/,anywhere:/Pull anywhere/,point_aim:/Tap the battlefield/,auto_aim:/Lead moving targets/};
 for(const [mode,pattern] of Object.entries(hints)){const result=combatHudState(mock(mode));assert.match(result.aimHint,pattern);assert.equal(result.precisionName,'Precise shot');assert.equal(result.ready,true);}
});
test('draw state becomes release cue only for pull-back modes',()=>{
 for(const mode of ['classic','anywhere'])assert.equal(combatHudState(mock(mode),{aiming:true}).status,'Release to fire');
 for(const mode of ['point_aim','auto_aim'])assert.equal(combatHudState(mock(mode),{aiming:true}).status,'Ready');
});
test('cooldown is truthful and independent of draw',()=>{const battle=mock();battle.activeSkill.cooldown=67;const s=combatHudState(battle,{aiming:true});assert.equal(s.status,'Ready in 2s');assert.equal(s.ready,false);});
test('read-only presentation never mutates battle or queued input',()=>{const b=mock();b.input={mouseDown:true};b.queuedAim={vx:3,vy:-2};const before=JSON.stringify(b);combatHudState(b,{angle:32,power:78});assert.equal(JSON.stringify(b),before);});
test('precise-shot detail discloses saved values',()=>{const s=combatHudState(mock(),{angle:32,power:78});assert.equal(s.precisionDetail,'32° · 78%');assert.match(s.precisionLabel,/32 degrees and 78 percent/);});
test('airborne activation is distinct from launch and matches real objects',()=>{
 const b=mock();b.activationObjects=[{kind:'flak_arrow'}];assert.equal(combatHudState(b).activationLabel,'Burst');assert.match(combatHudState(b).activationAria,/airborne flak/);
 b.activationObjects=[{kind:'thunder_arrow'}];assert.equal(combatHudState(b).activationLabel,'Storm');assert.equal(combatHudState(b,{keyboard:true}).activationDetail,'SPACE · AIRBORNE');
 b.activationObjects.push({kind:'flak_arrow'});assert.equal(combatHudState(b).activationLabel,'Activate');
});
test('movement and battle progress have actual state',()=>{const b=mock();b.hero.garrisoned=()=>false;const s=combatHudState(b,{keyboard:true});assert.equal(s.heroState,'On foot');assert.equal(s.moveLabel,'A / D · Move');assert.equal(s.enemies,'2 enemies · 34 incoming');assert.equal(s.title,'Battle 17');});
test('summon context never describes an arrow angle',()=>{const b=mock();b.activeSkill.id='grunt';const s=combatHudState(b);assert.equal(s.precisionName,'Summon squad');assert.equal(s.precisionDetail,'20 GOLD');assert.equal(s.status,'Squad ready');});
test('module tolerates absent optional HUD and no window',()=>{const b=mock();assert.equal(updateCombatHud(b,{}, {querySelector:()=>null}).name,'Basic Arrow');});

// Director final-stand status belongs in the always-visible desktop HUD as well
// as the paused report/portrait view. Corpses remain engine slots, not live foes.
test('live enemy counter excludes dead, destroyed and zero-health corpses',()=>{const b=mock();b.badTeam.push({hp:0},{hp:3,dead:true},{hp:7,destroyed:true});assert.equal(combatHudState(b).enemies,'2 enemies · 34 incoming');});
test('desktop final stand persists while one or more living enemies remain',()=>{const b=mock();b.enemies={finalStand:true,remaining:0};assert.equal(combatHudState(b).enemies,'Final stand · 2 enemies');b.badTeam[0].hp=0;assert.equal(combatHudState(b).enemies,'Final stand · 1 enemy');});
test('final stand explains pending boss and ordinary corpse cleanup without a false live count',()=>{const b=mock();b.badTeam=[{hp:0},{hp:0,dead:true}];b.enemies={finalStand:true,remaining:1};assert.equal(combatHudState(b).enemies,'Final stand · Gorath incoming');b.enemies.remaining=0;assert.equal(combatHudState(b).enemies,'Final stand · Clearing field');});
test('final-stand text is written to the real desktop HUD and stays read-only',()=>{const b=mock();b.enemies={finalStand:true,remaining:0};const before=JSON.stringify(b),label={textContent:''},hud={dataset:{}};const root={querySelector:selector=>selector==='.live-hud'?hud:selector==='#combatEnemyState'?label:null};updateCombatHud(b,{},root);assert.equal(label.textContent,'Final stand · 2 enemies');assert.equal(JSON.stringify(b),before);});
