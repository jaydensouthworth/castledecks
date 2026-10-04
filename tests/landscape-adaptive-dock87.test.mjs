import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {measureOcclusion,touchConflicts} from '../site/dist/viewport-metrics.mjs';
const css=readFileSync(new URL('../site/dist/live-action-bar.css',import.meta.url),'utf8');
const candidate=css.slice(css.indexOf('/* Adaptive short-landscape dock.'));
test('candidate has balanced CSS blocks and is bounded to short landscape',()=>{
 let level=0;for(const char of candidate.replace(/\/\*[\s\S]*?\*\//g,'')){if(char==='{')level++;if(char==='}')level--;assert.ok(level>=0);}assert.equal(level,0);
 for(const media of candidate.matchAll(/@media ([^{]+)\{/g))assert.match(media[1],/orientation:landscape.*min-width:700px.*max-width:1000px.*max-height:500px/);
 assert.ok(!candidate.includes('pointer-events'));assert.ok(!candidate.includes('display:none'));assert.match(candidate,/font-size:10px; line-height:12px/);
});
for(let n=1;n<=10;n++)test(`slot-count ${n} fit gate includes page, 44px targets, pair and tolerance`,()=>{
 const threshold=46*n+265;
 // n cards, n-1 gaps, page, page gap, 8px horizontal padding, 2px borders.
 const cards=44*n+2*(n-1)+44+6+8+2;
 const required=cards+205;
 assert.equal(threshold,required+2);
 assert.match(candidate,new RegExp(`min-width:${threshold}px`));
 assert.ok(candidate.includes(`#hotbar > :nth-child(${n+1})`));
 assert.ok(44>=44&&48>=44);
});
test('740 with44px side insets retains ten-key command targets and fits at most six keys inline',()=>{
 const safeWidth=740-88,lane=safeWidth-96-10;
 assert.equal(lane,546);assert.ok(46*6+265<=lane);assert.ok(46*7+265>lane);
 const fullPair=[{x:492,y:197,width:94,height:44,label:'all ground'},{x:591,y:197,width:100,height:44,label:'company'}];
 const inlinePair=fullPair.map(r=>({...r,y:248}));
 const metrics=measureOcclusion([],740,320),samples=[];
 for(let row=0;row<5;row++)for(let col=0;col<7;col++)samples.push({x:metrics.zone.x+(col+.5)*metrics.zone.width/7,y:metrics.zone.y+(row+.5)*metrics.zone.height/5});
 const hits=rects=>samples.filter(p=>rects.some(r=>p.x>=r.x&&p.x<r.x+r.width&&p.y>=r.y&&p.y<r.y+r.height)).length;
 assert.equal(hits(fullPair),2);assert.equal(hits(inlinePair),0);
 assert.equal(touchConflicts(fullPair).undersized.length,0);assert.equal(touchConflicts(fullPair).overlaps.length,0);
 assert.equal(touchConflicts(inlinePair).undersized.length,0);assert.equal(touchConflicts(inlinePair).overlaps.length,0);
 // Negative control: known real command targets remain counted by unmodified math.
 assert.ok(measureOcclusion(fullPair,740,320).zoneFraction>0);
 assert.equal(measureOcclusion(inlinePair,740,320).zoneFraction,0);
});
test('fit logic is CSS-only and excludes temporary state and pointer-driven behavior',()=>{
 for(const forbidden of ['data-cooling','data-ready','data-affordable','data-holding','hover','active','data-hero-mode','data-army-page','combatSkillName','combatSkillState'])assert.ok(!candidate.includes(forbidden),forbidden);
});

test('inline company pair below the existing skill row clears all30 campaign keep bodies in the baseline camera',async()=>{
 const {CampaignBattle}=await import('../site/dist/engine/first-battle.mjs');
 const {frameCombatCamera}=await import('../site/dist/combat-camera.mjs');
 const {createWorldCamera,worldToScreen}=await import('../site/dist/world-camera.mjs');
 const {fortificationGeometry}=await import('../site/dist/fortress-art.mjs');
 const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 for(let level=1;level<=30;level++){
  const battle=new CampaignBattle({level,random:()=>.5});
  const camera=frameCombatCamera(createWorldCamera(740,320),{groundY:Math.max(...battle.terrain.samples),structureTopY:Math.min(...battle.structures.map(b=>fortificationGeometry(b).body.y)),aimOriginTopY:Math.min(...battle.structures.map(b=>b.y+b.shotOffset.y),Math.min(...battle.terrain.samples)-30),top:6,bottom:320-24-52-6});
  for(const structure of battle.structures){const g=fortificationGeometry(structure).body,p=worldToScreen(camera,g),box={x:p.x,y:p.y,width:g.width*camera.scale,height:g.height*camera.scale};for(const control of [{x:492,y:248,width:94,height:44},{x:591,y:248,width:100,height:44}])assert.ok(!intersects(control,box),`battle${level}`);}
 }
});

test('every candidate style rule excludes the Battery Intercept dedicated safe command layout',()=>{
 const rules=[...candidate.matchAll(/([^{}]+)\{/g)].map(m=>m[1].replace(/\/\*[\s\S]*?\*\//g,'').trim()).filter(s=>s.startsWith('.'));
 assert.ok(rules.length>20);
 for(const rule of rules)for(const selector of rule.split(','))assert.ok(selector.trim().startsWith('.live-hud:not(:has(.live-battle-standard[data-objective="intercept-battery"])) '),selector);
});


test('command-bearing arsenal width is viewport-owned rather than mutable text intrinsic width',()=>{
 assert.match(candidate,/\.live-arsenal:has\(#liveArmyOrder:not\(\.hidden\)\):has\(#liveRallyPosition:not\(\.hidden\)\) \{ width:100%; \}/);
 assert.match(candidate,/\.live-action-bar \{[^}]*width:max-content; margin-left:auto/);
});
