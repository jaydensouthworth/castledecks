/** Inject the actual game codecs. The transport never treats server storage as
 * proof of ownership/earned progress, and never restores a document by itself. */
export function createGameSaveCodecs({parseLocalCheckpoint,restoreExpeditions,parseDeckCode}){
 if([parseLocalCheckpoint,restoreExpeditions,parseDeckCode].some(fn=>typeof fn!=='function'))throw new TypeError('Actual game codecs required');
 return Object.freeze({validate(kind,text){if(typeof text!=='string')throw new TypeError('Document must be text');switch(kind){case 'crownroad':return parseLocalCheckpoint(text);case 'wayfarer':return restoreExpeditions(text);case 'decks':return parseDeckCode(text);default:throw new TypeError('Unknown document kind');}}});
}
