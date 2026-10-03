import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('../site/dist/skirmish.css',import.meta.url),'utf8');
const panelRules=[...css.matchAll(/#skirmishPanel\{([^}]+)\}/g)].map(m=>m[1]);
test('Skirmish keeps shared horizontal inset ownership and an auto width',()=>{
 assert.match(panelRules[0],/(?:^|;)width:auto;/);assert.match(panelRules[0],/max-width:1120px;/);
 for(const rule of panelRules){assert.doesNotMatch(rule,/(?:^|;)(?:inset|left|right):/);assert.doesNotMatch(rule,/(?:^|;)width:(?!auto)/);}
 assert.equal(panelRules.filter(r=>r.includes('max-height:')).length,1);
 assert.match(panelRules[0],/max-height:calc\(100dvh - max\(var\(--skirmish-panel-gap\),env\(safe-area-inset-top\),var\(--preview-safe-top,0px\)\) - max\(var\(--skirmish-panel-gap\),env\(safe-area-inset-bottom\),var\(--preview-safe-bottom,0px\)\)\)/);
 assert.match(css,/@media\(max-height:600px\) and \(orientation:landscape\)\{#skirmishPanel\{--skirmish-panel-gap:10px\}\}/);
 assert.match(css,/@media\(orientation:portrait\)\{#skirmishPanel\{--skirmish-panel-gap:12px\}\}/);
});
test('sticky header stays non-shrinking while the panel retains its scroll owner',()=>{
 assert.match(css,/#skirmishPanel \.panel-head\{flex-shrink:0;position:sticky;top:0;/);
 assert.match(panelRules[0],/overflow:auto/);
});
for(const [w,h] of [[1920,1080],[1280,720],[915,360],[740,320],[560,450],[412,780],[320,740]])for(const safe of [0,24,44])test(`${w}x${h}, ${safe}px safe insets: bounded panel and stable header budget`,()=>{
 const portrait=h>w,compact=!portrait&&h<=600,vertical=portrait?12:compact?10:24,horizontal=portrait?10:compact?15:24;
 const top=Math.max(vertical,safe),bottom=Math.max(vertical,safe),left=Math.max(horizontal,safe),right=Math.max(horizontal,safe);
 const width=Math.min(1120,w-left-right),height=h-top-bottom;
 assert.ok(width>0&&height>0);assert.ok(left+width<=w-right);assert.ok(top+height<=h-bottom);
 // Structural budget only, not a native text or rendering measurement.
 assert.ok(height-80>0,'a non-shrinking 80px header leaves a scrollable body budget');
 if(w===740&&safe===44)assert.equal(width,652);
});
