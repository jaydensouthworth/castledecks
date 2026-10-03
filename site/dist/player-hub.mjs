/** Play destinations are separate sessions. Only the campaign is earned progress.
 * This registry describes real, implemented routes; it does not change saves,
 * award progress, or imply that future campaigns or multiplayer are playable.
 */
export const PLAY_DESTINATIONS=Object.freeze([
 Object.freeze({id:'campaign',buttonId:'introCampaign',name:'The Crownroad',kind:'CAMPAIGN',description:'Thirty fields across Hearthwood, Bannerfen, Frostpine and the Cinderlands. Earn your road to the Ashen Throne.',route:'./battle'}),
 Object.freeze({id:'expedition',buttonId:'introExpedition',name:'Wayfarer Charter',kind:'EXPEDITION',description:'Four earned fields, branching roads and keep-breaking sieges. A separate charter with its own supplied starting kit and save.',route:'./battle?mode=expedition'}),
 Object.freeze({id:'skirmish',buttonId:'introSkirmish',name:'Seeded Skirmish',kind:'PRACTICE',description:'Generate a fresh battlefield and finite company. Replay a seed with a supplied practice kit; campaign progress stays separate.',route:'./battle?mode=skirmish'}),
 Object.freeze({id:'midgame',buttonId:'introDemo',name:'Midgame rehearsal',kind:'PRACTICE',description:'Assisted Battle 13. Rank 8 archer and a prepared army.',route:'./battle?mode=demo'}),
 Object.freeze({id:'allies',buttonId:'introAlliesDemo',name:'Allies showcase',kind:'PRACTICE',description:'Assisted Battle 13 with a supplied Fire Dragon and Gorath.',route:'./battle?mode=demo&showcase=companions'}),
 Object.freeze({id:'training',buttonId:'introTraining',name:'Training playground',kind:'PRACTICE',description:'Optional guided drills, plus a separate assisted profile with battle and ability test controls.',route:'./battle?mode=test'}),
]);
export function destinationForMode({demoMode=false,recruitShowcase=false,testingMode=false,expeditionMode=false,skirmishMode=false}={}){
 return skirmishMode?'skirmish':expeditionMode?'expedition':demoMode?(recruitShowcase?'allies':'midgame'):testingMode?'training':'campaign';
}
export function playDestinationURL(id,shootingMode='classic'){
 const item=PLAY_DESTINATIONS.find(item=>item.id===id);
 if(!item)throw new RangeError('Unknown play destination');
 if(!['midgame','allies'].includes(id)||!['anywhere','point_aim','auto_aim'].includes(shootingMode))return item.route;
 return item.route+'&aim='+encodeURIComponent(shootingMode);
}
export function canPurchaseInArmory({started=false,summary=null}={}){
 return summary?!summary.campaignComplete:!started;
}
