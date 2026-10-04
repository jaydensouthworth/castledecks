export const UPLOAD_JOURNAL_KEY='castledecks:cloud:pending-upload:v1';
const MAX_BYTES=6*(2*1024*1024+8192)+2048;
const fields=['schema','accountID','kind','slot','expectedRevision','document','createdAt'];
export function createUploadJournal({storage,validateDocument}){
 const source=()=>typeof storage==='function'?storage():storage;
 function validate(note){if(!note||Object.keys(note).length!==fields.length||fields.some(key=>!Object.hasOwn(note,key))||note.schema!=='castledecks-cloud-upload-1'||typeof note.accountID!=='string'||note.accountID.length<1||note.accountID.length>128||!['crownroad','wayfarer','decks'].includes(note.kind)||!Number.isSafeInteger(note.slot)||note.slot<1||note.slot>3||!Number.isSafeInteger(note.expectedRevision)||note.expectedRevision<0||note.expectedRevision>=Number.MAX_SAFE_INTEGER||!Number.isSafeInteger(note.createdAt)||note.createdAt<0)throw new Error('Unrecognized upload recovery note');validateDocument(note.kind,note.document);return Object.freeze({...note});}
 function read(){try{const raw=source().getItem(UPLOAD_JOURNAL_KEY);if(raw===null)return {pending:null,blocked:false};if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>MAX_BYTES)throw new Error('Recovery note too large');return {pending:validate(JSON.parse(raw)),blocked:false};}catch{return {pending:null,blocked:true};}}
 function save(note){const captured=validate(note),raw=JSON.stringify(captured);if(new TextEncoder().encode(raw).byteLength>MAX_BYTES)throw new Error('Recovery note too large');const s=source();if(s.getItem(UPLOAD_JOURNAL_KEY)!==null)throw new Error('Resolve the existing recovery note first');s.setItem(UPLOAD_JOURNAL_KEY,raw);if(s.getItem(UPLOAD_JOURNAL_KEY)!==raw)throw new Error('Recovery note could not be verified');return captured;}
 function clear(note){const s=source(),raw=s.getItem(UPLOAD_JOURNAL_KEY);if(raw===null)return;if(raw!==JSON.stringify(validate(note)))throw new Error('Recovery note changed');s.removeItem(UPLOAD_JOURNAL_KEY);if(s.getItem(UPLOAD_JOURNAL_KEY)!==null)throw new Error('Recovery note could not be cleared');}
 return Object.freeze({read,save,clear});
}
