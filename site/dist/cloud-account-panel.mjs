/** Explicitly mounted only by the future opt-in game integration. */
export function mountCloudAccountPanel({root,document,model,enabled=false,describeDocument=()=>''}){
 root.hidden=!enabled;if(!enabled)return {dispose(){}};
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const title=el('h3','Optional cloud saves'),status=el('p'),actions=el('div'),refresh=el('button','Check cloud account'),login=el('button','Prepare Google sign-in'),link=el('a','Open Google in a separate tab'),logout=el('button','Sign out'),kind=el('select'),slot=el('select'),upload=el('button','Review upload'),restore=el('button','Preview cloud save'),preview=el('div'),confirm=el('button'),cancel=el('button','Cancel cloud review'),reconcile=el('button','Check earlier upload');
 for(const [name,node] of Object.entries({status,refresh,login,link,logout,kind,slot,upload,restore,preview,confirm,cancel,reconcile}))node.id='cloud-'+name;
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');kind.setAttribute('aria-label','Cloud collection');slot.setAttribute('aria-label','Cloud slot');link.target='_blank';link.rel='noopener noreferrer';
 for(let n=1;n<=3;n++){const option=el('option',`Slot ${n}`);option.value=String(n);slot.append(option);}slot.value='1';
 for(const button of [refresh,login,logout,upload,restore,confirm,cancel,reconcile])button.type='button';
 actions.className='cloud-account-actions';actions.append(refresh,login,link,logout);root.className+=' cloud-account-panel';root.append(title,el('p','Google identifies your account. Uploads copy only the checkpoint or decks you review. These are client-reported saves, not verified competitive results. Signing out keeps cloud copies. An unfinished upload keeps a recovery copy in this tab; clearing tab or site data can erase it.'),status,actions,kind,slot,upload,restore,preview,confirm,cancel,reconcile);
 const run=fn=>()=>Promise.resolve().then(fn).catch(error=>{status.textContent=error?.message||'Cloud action unavailable.';});
 refresh.onclick=run(()=>model.refresh());login.onclick=run(()=>model.login());logout.onclick=run(()=>model.logout());upload.onclick=run(()=>model.prepareUpload(kind.value,Number(slot.value)));restore.onclick=run(()=>model.prepareRestore(kind.value,Number(slot.value)));confirm.onclick=run(()=>model.confirm());cancel.onclick=()=>model.cancelReview();reconcile.onclick=run(()=>model.reconcile());kind.onchange=slot.onchange=()=>model.cancelReview();
 let signature='';
 const unsubscribe=model.subscribe(state=>{
  status.textContent=state.message;const next=state.kinds.join('|');if(next!==signature){const selected=kind.value;kind.replaceChildren();for(const value of state.kinds){const option=el('option',value==='crownroad'?'Crownroad':value==='wayfarer'?'Wayfarer':'Decks');option.value=value;kind.append(option);}kind.value=state.kinds.includes(selected)?selected:state.kinds[0]??'';signature=next;}
  const busy=state.phase==='loading'||state.phase==='writing';for(const button of [refresh,login,logout,upload,restore,confirm,reconcile])button.disabled=busy;
  kind.disabled=slot.disabled=busy||state.kinds.length===0;
  upload.disabled=busy||!state.account||state.pending!==null||state.blocked||state.kinds.length===0;restore.disabled=busy||!state.account||state.kinds.length===0;
  login.hidden=!!state.account&&!state.pending;logout.hidden=!state.account;reconcile.hidden=!state.pending;
  link.hidden=!state.loginURL;if(state.loginURL)link.href=state.loginURL;else link.removeAttribute('href');
  confirm.hidden=cancel.hidden=!state.review;preview.hidden=!state.review;preview.textContent=state.review?`${state.review.kind}, slot ${state.review.slot}. Cloud revision ${state.review.remote?.revision??0}. ${describeDocument(state.review.kind,state.review.remote?.document??state.review.captured.document)} ${state.review.type==='upload'?'Only the reviewed cloud slot will change.':'Review the stated restore effect before continuing.'}`:'';
  confirm.textContent=state.review?.type==='upload'?'Upload captured checkpoint':state.review?.kind==='wayfarer'?'Replace this charter session':'Continue to game import review';
 });
 return {dispose(){unsubscribe();model.leave();root.replaceChildren();root.hidden=true;}};
}
