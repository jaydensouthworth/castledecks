/** Isolated host contract. The game supplies actual capture/codecs/native import
 * staging. No profile selection or live save source is guessed by this module. */
export function createCloudGameBridge({getState,captureDocument,validateDocument,reviewCrownroad,replaceWayfarer,reviewDecks,restorePlan,beginRestore}){
 function kinds(){const s=getState();if(s.temporarySession!==false||(s.started||s.battle?.outcome)&&!s.battle?.summary)return [];return s.destination==='campaign'?['crownroad','decks']:s.destination==='expedition'?['wayfarer','decks']:[];}
 function context(kind){const s=getState();if(!kinds().includes(kind)||!Number.isSafeInteger(s.loadGeneration)||!Number.isSafeInteger(s.localReviewIntent))throw new Error('Cloud saves are unavailable in this session');return {profiles:s.profiles,profile:s.profiles?.active,battle:s.battle,destination:s.destination,temporarySession:s.temporarySession,loadGeneration:s.loadGeneration,localReviewIntent:s.localReviewIntent,started:s.started,summary:s.battle?.summary};}
 function capture(kind){const token=context(kind),document=captureDocument(kind);validateDocument(kind,document);return Object.freeze({kind,document,token});}
 function matches(captured){try{const current=context(captured.kind);return Object.keys(captured.token).every(key=>current[key]===captured.token[key])&&captureDocument(captured.kind)===captured.document;}catch{return false;}}
 function planRestore(kind,document){return restorePlan?.(kind,document,validateDocument(kind,document))??null;}
 function restore(kind,document,captured,choice){if(kind!==captured.kind||!matches(captured))throw new Error('The current game or import choice changed');const parsed=validateDocument(kind,document);if(kind==='wayfarer'){replaceWayfarer(document,parsed);return {replaced:true};}const result=kind==='crownroad'?reviewCrownroad(document,parsed,choice):reviewDecks(document,parsed,choice);if(result?.restored===true)return {restored:true};if(result?.staged!==true)throw new Error('Native import review was not staged');return {staged:true};}
 return Object.freeze({kinds,capture,matches,planRestore,restore,beginRestore});
}
