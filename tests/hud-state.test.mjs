import test from 'node:test';
import assert from 'node:assert/strict';
import {flagDescription,heroExperience,summonMessage} from '../site/dist/hud-state.mjs';
import {PlayerProfile} from '../site/dist/engine/progression.mjs';
import {FriendlyReinforcements} from '../site/dist/engine/campaign.mjs';
test('flag HUD follows holder team and distinguishes ground, base and capture',()=>{
 for(const status of [1,2]){assert.equal(flagDescription({status,holder:{team:'good'}}),'allied carrier');assert.equal(flagDescription({status,holder:{team:'bad'}}),'enemy carrier');}
 assert.equal(flagDescription({status:0}),'on the ground');assert.equal(flagDescription({status:3}),'at base');assert.equal(flagDescription({status:4}),'captured');
});
test('hero XP readout remains finite at the rank cap and signed carry',()=>{
 assert.deepEqual(heroExperience({rank:1,xp:250}),{text:'250 / 500 XP',fraction:.5});assert.equal(heroExperience({rank:26,xp:900}).fraction,1);assert.equal(heroExperience({rank:26,xp:900}).text,'Rank cap reached');assert.equal(heroExperience({rank:1,xp:-10}).fraction,0);
});
test('summon feedback identifies the same limiting resource as the squad gate',()=>{
 const p=new PlayerProfile(),s=p.addSkill('grunt'),q=new FriendlyReinforcements();assert.match(summonMessage(s,p,q),/reloads/);s.cooldown=0;assert.match(summonMessage(s,p,q),/20 gold/);p.gold=20;q.population=3;assert.match(summonMessage(s,p,q),/4 population/);q.population=20;q.queue=Array(15).fill({});assert.match(summonMessage(s,p,q),/full/);q.queue=[];assert.match(summonMessage(s,p,q),/squad queued/);
});
