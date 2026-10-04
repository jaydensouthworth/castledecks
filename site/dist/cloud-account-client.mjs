/** New post-reset transport. Same-origin only; no retry or local-save mutation. */
export class AccountError extends Error {
 constructor(code,{status=0,uncertain=false}={}){super(code);this.name='AccountError';this.code=code;this.status=status;this.uncertain=uncertain;}
}
const safeInteger=(v,min=0)=>Number.isSafeInteger(v)&&v>=min;
const kinds=new Set(['crownroad','wayfarer','decks']);
const slotKey=(kind,slot)=>{if(!kinds.has(kind)||!safeInteger(slot,1)||slot>3)throw new AccountError('invalid-slot');return `${kind}/${slot}`;};
const definitive=new Set([400,401,403,404,409,413,415,428,429]);
export function createAccountClient({fetch:fetcher=globalThis.fetch,validateDocument,timeout=15000}={}){
 if(typeof fetcher!=='function'||typeof validateDocument!=='function')throw new TypeError('Fetch and game codec validation required');
 let epoch=0,session=null;
 const invalidate=()=>{epoch++;session=null;};
 const current=stamp=>{if(stamp!==epoch)throw new AccountError('stale-response');};
 const capture=()=>{if(!session)throw new AccountError('sign-in-required');return {stamp:epoch,account:{...session}};};
 async function request(path,{method='GET',body,csrf,revision,stamp=epoch}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
   const headers={Accept:'application/json'};if(csrf)headers['X-CSRF-Token']=csrf;if(body!==undefined)headers['Content-Type']='application/json';if(revision!==undefined)headers['If-Match']=`"${revision}"`;
   const response=await fetcher('/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
   if(!response.ok){if((response.status===401||response.status===403)&&stamp===epoch)invalidate();throw new AccountError(response.status===409?'revision-conflict':response.status===401?'sign-in-required':response.status===403?'account-changed':'request-failed',{status:response.status});}
   if(response.status===204)return null;
   if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new AccountError('invalid-response');
   const raw=await response.text();if(raw.length>6*(2*1024*1024+8192)+512)throw new AccountError('invalid-response');
   try{return JSON.parse(raw);}catch{throw new AccountError('invalid-response');}
  }finally{clearTimeout(timer);}
 }
 function metadata(value,{document=false,kind,slot}={}){
  if(!value||typeof value!=='object'||!kinds.has(value.kind)||!safeInteger(value.slot,1)||value.slot>3||!safeInteger(value.revision,1)||!safeInteger(value.updatedAt)||value.trust!=='client-reported'||(kind!==undefined&&value.kind!==kind)||(slot!==undefined&&value.slot!==slot))throw new AccountError('invalid-response');
  if(document){if(typeof value.document!=='string')throw new AccountError('invalid-response');validateDocument(value.kind,value.document);}
  return {...value};
 }
 async function mutation(path,options,finish){
  const {stamp,account}=capture();
  try{const value=await request(path,{...options,stamp,csrf:account.csrfToken});current(stamp);return finish(value,account);}
  catch(error){if(error instanceof AccountError&&definitive.has(error.status))throw error;throw new AccountError('write-unverified',{status:error?.status??0,uncertain:true});}
 }
 return Object.freeze({
  invalidate,
  async account(){const stamp=++epoch;session=null;const v=await request('/account',{stamp});current(stamp);if(!v||typeof v.id!=='string'||!v.id||typeof v.csrfToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.csrfToken)||!safeInteger(v.expiresAt,1))throw new AccountError('invalid-response');session={id:v.id,csrfToken:v.csrfToken,expiresAt:v.expiresAt};return {...session};},
  async login(){const stamp=epoch;const v=await request('/auth/google/start',{method:'POST',stamp});current(stamp);let u;try{u=new URL(v.url);}catch{throw new AccountError('invalid-response');}if(u.origin!=='https://accounts.google.com'||u.pathname!=='/o/oauth2/v2/auth'||u.username||u.password||u.hash)throw new AccountError('invalid-response');return u.href;},
  async list(){const {stamp,account}=capture();const v=await request('/saves',{stamp,csrf:account.csrfToken});current(stamp);if(!Array.isArray(v?.saves)||v.saves.length>9)throw new AccountError('invalid-response');const seen=new Set();return v.saves.map(value=>{const record=metadata(value),key=slotKey(record.kind,record.slot);if(seen.has(key))throw new AccountError('invalid-response');seen.add(key);return record;});},
  async download(kind,slot){const path=slotKey(kind,slot),{stamp,account}=capture();let v;try{v=await request('/saves/'+path,{stamp,csrf:account.csrfToken});}catch(error){current(stamp);if(error.status===404)return null;throw error;}current(stamp);return metadata(v,{document:true,kind,slot});},
  async upload(kind,slot,document,revision){const path=slotKey(kind,slot);if(!safeInteger(revision)||revision>=Number.MAX_SAFE_INTEGER)throw new AccountError('invalid-revision');validateDocument(kind,document);return mutation('/saves/'+path,{method:'PUT',revision,body:{document}},value=>{const record=metadata(value,{document:true,kind,slot});if(record.revision!==revision+1||record.document!==document)throw new AccountError('invalid-response');return record;});},
  async logout(){return mutation('/auth/logout',{method:'POST'},()=>{invalidate();return true;});},
  async deleteAccount(confirm){if(confirm!=='DELETE MY ACCOUNT')throw new AccountError('confirmation-required');return mutation('/account',{method:'DELETE',body:{confirm}},()=>{invalidate();return true;});}
 });
}
