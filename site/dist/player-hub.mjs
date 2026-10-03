/** Play destinations are separate sessions. Only the campaign is earned progress.
 * This registry describes real, implemented routes; it does not change saves,
 * award progress, or imply that future campaigns or multiplayer are playable.
 */
export const PLAY_DESTINATIONS=Object.freeze([
 Object.freeze({id:'campaign',buttonId:'introCampaign',name:'Campaign',kind:'CAMPAIGN',description:'Defend your realm through the current 30-battle campaign.',route:'./battle'}),
 Object.freeze({id:'midgame',buttonId:'introDemo',name:'Midgame rehearsal',kind:'PRACTICE',description:'Assisted Battle 13. Rank 8 archer and a prepared army.',route:'./battle?mode=demo'}),
 Object.freeze({id:'allies',buttonId:'introAlliesDemo',name:'Allies showcase',kind:'PRACTICE',description:'Assisted Battle 13 with a supplied Fire Dragon and Gorath.',route:'./battle?mode=demo&showcase=companions'}),
 Object.freeze({id:'training',buttonId:'introTraining',name:'Training playground',kind:'PRACTICE',description:'A separate assisted profile with battle and ability test controls.',route:'./battle?mode=test'}),
]);
export function destinationForMode({demoMode=false,recruitShowcase=false,testingMode=false}={}){
 return demoMode?(recruitShowcase?'allies':'midgame'):testingMode?'training':'campaign';
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
