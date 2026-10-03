import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameUI,deferredFile} from './helpers/game-ui-harness.mjs';
import {CampaignProfiles} from '../site/dist/engine/profile-manager.mjs';
import {MemoryStorage} from './helpers/local-storage.mjs';
const bundle=name=>new CampaignProfiles({defaultName:name}).exportBundle();
for(const valid of [true,false])test(`a newly selected ${valid?'valid':'invalid'} file cancels the older staged import before its read resolves`,async t=>{
 const ui=await loadGameUI(t,{storage:new MemoryStorage()});ui.click('introLoad');ui.get('loadCode').value=bundle('Staged A');ui.click('importCode');assert.equal(ui.visible('localConfirm'),true);
 const original=ui.battle,oldAccept=ui.get('localConfirmAccept').onclick,b=deferredFile(),reading=ui.load(b.file);assert.equal(ui.visible('localConfirm'),false);assert.match(ui.get('saveStatus').textContent,/Reading campaign file/);
 oldAccept();await ui.settle();assert.equal(ui.battle,original,'stale confirmation cannot adopt A');
 b.resolve(valid?bundle('Wanted B'):'bad file');await reading;
 if(valid){assert.equal(ui.visible('localConfirm'),true);assert.match(ui.get('localConfirmText').textContent,/Wanted B/);assert.equal(ui.battle,original);ui.click('localConfirmAccept');await ui.settle();assert.equal(ui.battle.profile.name,'Wanted B');}
 else{assert.equal(ui.visible('localConfirm'),false);assert.equal(ui.battle,original);assert.match(ui.get('saveStatus').textContent,/not a valid/);oldAccept();await ui.settle();assert.equal(ui.battle,original);}
});
