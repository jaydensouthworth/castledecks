import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkirmish} from '../site/dist/skirmish-model.mjs';
import {skirmishBriefHTML} from '../site/dist/skirmish-ui.mjs';
test('workshop gives concise aiming and seed guidance while keeping practice, deck and cost warnings',()=>{
 const markup=skirmishBriefHTML(createSkirmish());
 assert.match(markup,/Use full-power Auto aim for distant shots and lead moving targets\./);
 assert.match(markup,/A seed recreates the starting field; your actions shape the battle\./);
 assert.doesNotMatch(markup,/Sampled high-arc|reach checked|human play still matter/);
 for(const text of ['Ordinary costs, damage and cooldowns apply.','Every retry resets to these supplies.','No campaign progress or save is changed.','Export their deck codes before a fresh retry, restart or new field.'])assert.ok(markup.includes(text));
});
