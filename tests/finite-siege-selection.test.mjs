import test from 'node:test';import assert from 'node:assert/strict';
const dist=process.env.BOWMASTER_TEST_DIST??new URL('../site/dist/',import.meta.url).href;
const {FirstBattle}=await import(new URL('engine/first-battle.mjs',dist));
function fixture(){const b=new FirstBattle({random:()=>.5});b.enemies.step=()=>null;b.friendlyQueue.step=()=>null;b.hero.leaveGarrison();b.hero.x=300;b.hero.y=b.elevationAt(300);const siege=b.createUnit('trebuchet');siege.x=1500;siege.y=b.elevationAt(1500);return {b,siege};}
test('siege excludes an invalid actor awaiting its ground recovery turn',()=>{const {b,siege}=fixture(),invalid=b.createUnit('grunt',{team:'good'});invalid.x=10;invalid.y=NaN;assert.equal(siege.distanceTo(invalid),Infinity);assert.equal(siege.selectTarget(),b.hero);assert.equal(siege.rangedTarget,b.hero);});
test('siege with its own invalid geometry does not choose a ranged target',()=>{const {siege}=fixture();siege.y=NaN;assert.equal(siege.selectTarget(),null);});
test('siege retains valid farthest-target choice and original strict minimum range',()=>{const {b,siege}=fixture(),far=b.createUnit('grunt',{team:'good'});far.x=100;far.y=b.elevationAt(100);assert.equal(siege.selectTarget(),far);far.hp=0;b.hero.x=1500;b.hero.y=siege.y;assert.equal(siege.selectTarget(),null);});
