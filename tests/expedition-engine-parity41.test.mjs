import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CampaignBattle} from '../site/dist/engine/first-battle.mjs';
import {seededRandom} from '../site/dist/engine/combat.mjs';
import {serializeProfile} from '../site/dist/engine/progression.mjs';
// Exact frozen41 constructor source. Only its relative import URLs are resolved
// against the unchanged shared engine dependencies to make this test fixture
// executable outside dist/. No source branches or behavior are substituted.
const frozen=readFileSync(new URL('./fixtures/frozen41-first-battle.mjs.txt',import.meta.url),'utf8');
assert.equal(createHash('sha256').update(frozen).digest('hex'),'731ac6f8b9cd82ffd763a2b476bee05ec214554b934a0bf90333cb73730869cf');
const engineURL=new URL('../site/dist/engine/',import.meta.url);
const source=frozen.replace(/from '(\.\/[^']+)'/g,(_,specifier)=>`from '${new URL(specifier,engineURL).href}'`);
const {CampaignBattle:FrozenCampaignBattle}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const entity=u=>[u.type,u.kind,u.team,u.x,u.y,u.hp,u.dead,u.destroyed,u.actionMode,u.occupiedBy,u.status,u.active,u.vx,u.vy];
const snapshot=b=>({tick:b.tick,levelData:b.levelData,terrain:b.terrain.samples,profile:serializeProfile(b.profile),stats:{...b.stats},outcome:b.outcome,summary:b.summary,units:[...b.goodTeam,...b.badTeam].map(entity),structures:b.structures.map(entity),flags:[b.ownFlag,b.enemyFlag].map(entity),objects:b.objects.items.map(entity),queue:b.friendlyQueue.queue.map(v=>({...v})),population:b.friendlyQueue.population,wave:{maximum:b.wave.maximum,remaining:b.wave.remaining,delay:b.wave.delay,countdown:b.wave.countdown},director:{roster:b.enemies.roster,index:b.enemies.index,remaining:b.enemies.remaining,timer:b.enemies.timer,phase:b.enemies.phase}});
const play=(Factory,level,encounter)=>{let calls=0;const random=seededRandom(42),events=[],b=new Factory({level,random:()=>{calls++;return random();},onEvent:e=>events.push([e.type,e.tick,e.kind,e.outcome,e.damage,e.amount,e.target?.type,e.castle?.team,e.summary?{...e.summary}:null]),...(encounter===null?{encounter:null}:{})});const samples=[snapshot(b)];for(let i=0;i<9000&&!b.summary;i++){b.step();if(i%600===599)samples.push(snapshot(b));}samples.push(snapshot(b));return {calls,events,samples};};
for(const level of [1,16,30])test(`optional encounter hook preserves exact frozen41 default Battle ${level} simulation, RNG and settlement`,()=>{
 const expected=play(FrozenCampaignBattle,level);assert.deepEqual(play(CampaignBattle,level),expected);assert.deepEqual(play(CampaignBattle,level,null),expected);
});
