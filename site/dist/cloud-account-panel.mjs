/** Optional account controls. Sign-in opens synchronously from the player gesture;
 * every transfer still goes through the identity-bound model's explicit review. */
export function mountCloudAccountPanel({root,document,window=globalThis.window,model,enabled=false,describeDocument=()=>''}){
 root.hidden=!enabled;if(!enabled)return {open(){},leave(){},dispose(){}};
 const el=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
 const title=el('h3','Cloud saves'),identity=el('span','Guest','cloud-account-identity'),header=el('div',null,'cloud-account-header'),heading=el('div'),status=el('p',null,'cloud-account-status'),intro=el('p','Keep a copy for another device. You choose what to save and what to load.','cloud-account-intro'),actions=el('div',null,'cloud-account-actions');
 const refresh=el('button','Refresh'),login=el('button','Sign in with Google','cloud-google-button'),link=el('a','Continue to Google'),logout=el('button','Sign out'),kind=el('select'),slot=el('input'),upload=el('button','Save to cloud','primary'),restore=el('button','Load from cloud'),preview=el('section',null,'cloud-account-review'),confirm=el('button',null,'primary'),session=el('button'),cancel=el('button','Cancel'),reconcile=el('button','Verify saved copy'),recovery=el('div',null,'cloud-account-recovery');
 const workspace=el('div',null,'cloud-account-workspace'),typeField=el('label',null,'cloud-account-type'),slots=el('div',null,'cloud-account-slots'),transferActions=el('div',null,'cloud-account-transfer'),availability=el('p',null,'cloud-account-hint'),guest=el('p','You can keep playing and saving on this device without an account.','cloud-account-hint'),recoveryText=el('p'),details=el('details',null,'cloud-account-details');
 const reviewTitle=el('h4'),reviewContent=el('div',null,'cloud-review-copies'),reviewEffect=el('p'),reviewActions=el('div',null,'cloud-account-transfer');
 for(const [name,node] of Object.entries({status,identity,refresh,login,link,logout,kind,slot,upload,restore,preview,confirm,session,cancel,reconcile,workspace,availability,recovery}))node.id='cloud-'+name;
 title.id='cloud-heading';reviewTitle.id='cloud-review-title';reviewEffect.id='cloud-review-effect';confirm.setAttribute('aria-describedby',reviewEffect.id);session.setAttribute('aria-describedby',reviewEffect.id);root.setAttribute('aria-labelledby',title.id);root.setAttribute('aria-label','Cloud saves');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');kind.setAttribute('aria-label','Save type');slots.setAttribute('role','group');slots.setAttribute('aria-label','Cloud slots');preview.setAttribute('aria-labelledby',reviewTitle.id);preview.tabIndex=-1;
 slot.type='hidden';slot.value='1';link.target='_blank';link.rel='noopener noreferrer';
 for(const button of [refresh,login,logout,upload,restore,confirm,session,cancel,reconcile])button.type='button';
 heading.append(title,identity);header.append(heading,actions);actions.append(login,logout,refresh,link);typeField.append(el('span','Save type'),kind);transferActions.append(upload,restore);workspace.append(typeField,slot,slots,availability,transferActions);reviewActions.append(confirm,session,cancel);preview.append(reviewTitle,reviewContent,reviewEffect,reviewActions);recovery.append(recoveryText,reconcile);
 details.append(el('summary','How cloud saves work'),el('p','Signing in does not upload anything. Cloud copies and device saves are separate. Signing out keeps both. Checkpoints restart at the beginning of a field; they do not resume an unfinished battle.'),el('p','Cloud progress is player-reported. It is not a verified competitive result. If an upload is interrupted, keep this tab and its site data until the saved copy is verified.'));
 if(!String(root.className).includes('cloud-account-panel'))root.className+=' cloud-account-panel';root.replaceChildren();root.append(header,intro,status,guest,workspace,recovery,preview,details);
 const labels={crownroad:'Crownroad campaigns',wayfarer:'Wayfarer charters',decks:'Saved decks'},shortLabels={crownroad:'Crownroad',wayfarer:'Wayfarer',decks:'Decks'};
 const slotName=(type,value)=>`${shortLabels[type]||'Cloud'} slot ${value}`;
 const slotButtons=[];
 for(let n=1;n<=3;n++){const button=el('button',null,'cloud-slot-card'),name=el('strong'),saved=el('span'),date=el('small');button.type='button';button.id=`cloud-slot-${n}`;button.append(name,saved,date);button.onclick=()=>{if(button.disabled)return;slot.value=String(n);model.cancelReview();};slotButtons.push({button,name,saved,date,n});slots.append(button);}
 let active=true,disposed=false,signInEpoch=0,signInPending=false,signInAccountID=null,popup=null,pollTimer=null,loginFallback=false,signature='',lastReview=null;
 const closePopup=()=>{try{popup?.close();}catch{}popup=null;};
 const clearPoll=()=>{if(pollTimer!==null){(window?.clearTimeout?.bind(window)||globalThis.clearTimeout)(pollTimer);pollTimer=null;}};
 const endSignIn=()=>{signInEpoch++;signInPending=false;loginFallback=false;clearPoll();closePopup();};
 const friendly=message=>({'sign-in-required':'Play locally, or sign in to keep a cloud copy.','account-changed':'Your sign-in changed. Sign in again to see your cloud saves.','request-failed':'Cloud saves could not be reached. Try Refresh, or keep playing locally.','invalid-response':'Cloud saves could not be read safely. Try Refresh, or keep playing locally.','revision-conflict':'This cloud slot changed on another device. Review it again before saving.','Optional cloud saves.':'Sign in when you want a cloud copy.'}[message]||message);
 const run=fn=>()=>{if(disposed||!active)return Promise.resolve();return Promise.resolve().then(()=>{if(disposed||!active||['loading','writing'].includes(model.snapshot().phase))return;return fn();}).catch(error=>{if(active&&!disposed)status.textContent=friendly(error?.message)||'Cloud action unavailable.';});};
 const stopReview=()=>{model.cancelReview();};
 const resumeSignIn=async()=>{
  if(!active||disposed||!signInPending||['loading','writing'].includes(model.snapshot().phase))return;
  const stamp=signInEpoch;await model.refresh();if(stamp!==signInEpoch||!active)return;
  if(model.snapshot().account&&(!signInAccountID||model.snapshot().account.id!==signInAccountID||!popup)){endSignIn();model.sync();}
 };
 const watchPopup=stamp=>{clearPoll();const schedule=window?.setTimeout?.bind(window)||globalThis.setTimeout;pollTimer=schedule(async()=>{pollTimer=null;if(stamp!==signInEpoch||!active||!signInPending)return;let closed=false;try{closed=!popup||popup.closed;}catch{}if(closed){popup=null;await resumeSignIn();if(stamp===signInEpoch&&signInPending&&['loading','writing'].includes(model.snapshot().phase))watchPopup(stamp);}else watchPopup(stamp);},1000);pollTimer?.unref?.();};
 login.onclick=async()=>{
  if(disposed||!active||login.disabled)return;
  endSignIn();const stamp=signInEpoch;signInAccountID=model.snapshot().account?.id??null;signInPending=true;
  // Reserve a window before the first await, so browsers keep the user gesture.
  // Nulling opener before navigation avoids granting Google access to the game.
  try{popup=window?.open?.('about:blank','_blank')||null;if(popup){popup.opener=null;try{popup.document.title='Castledecks sign-in';popup.document.body.textContent='Opening Google sign-in… You can return to your game after signing in.';}catch{}}}catch{closePopup();}
  loginFallback=!popup;
  await model.login();
  if(stamp!==signInEpoch||disposed||!active){return;}
  const url=model.snapshot().loginURL;
  if(!url){endSignIn();return;}
  if(popup){try{popup.location.replace(url);watchPopup(stamp);status.textContent='Finish signing in with Google, then return here. Your game stays open.';}catch{closePopup();loginFallback=true;model.sync();}}
  if(loginFallback){status.textContent='Your browser blocked the sign-in window. Continue to Google below, then return here.';link.focus?.();}
 };
 const onFocus=()=>{void resumeSignIn();};
 const onVisibility=()=>{if(document.visibilityState!=='hidden')void resumeSignIn();};
 window?.addEventListener?.('focus',onFocus);document.addEventListener?.('visibilitychange',onVisibility);
 refresh.onclick=run(async()=>{endSignIn();await model.refresh();});logout.onclick=run(async()=>{endSignIn();await model.logout();});upload.onclick=run(()=>model.prepareUpload(kind.value,Number(slot.value)));restore.onclick=run(()=>model.prepareRestore(kind.value,Number(slot.value)));confirm.onclick=run(()=>model.confirm());cancel.onclick=()=>{const target=lastReview?.type==='restore'?restore:upload;stopReview();target.focus?.();};reconcile.onclick=run(()=>model.reconcile());kind.onchange=stopReview;
 const copyCard=(caption,text)=>{const card=el('div',null,'cloud-review-copy');card.append(el('span',caption),el('p',text||'No preview available.'));return card;};
 const dateText=value=>{try{return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));}catch{return 'Saved time unavailable';}};
 const unsubscribe=model.subscribe(state=>{
  if(disposed)return;
  status.textContent=friendly(state.message);const next=state.kinds.join('|');if(next!==signature){const selected=kind.value;kind.replaceChildren();for(const value of state.kinds){const option=el('option',labels[value]);option.value=value;kind.append(option);}kind.value=state.kinds.includes(selected)?selected:state.kinds[0]??'';signature=next;}
  const busy=state.phase==='loading'||state.phase==='writing';root.setAttribute('aria-busy',String(busy));identity.textContent=state.account?'Signed in with Google':busy?'Connecting…':'Guest';identity.setAttribute('data-connected',String(!!state.account));
  for(const button of [refresh,login,logout,upload,restore,confirm,session,reconcile])button.disabled=busy;
  kind.disabled=busy||state.kinds.length===0;
  workspace.hidden=!state.account;guest.hidden=!!state.account;refresh.hidden=!state.account&&state.phase!=='error';refresh.textContent=state.phase==='error'?'Try again':'Refresh';login.hidden=!!state.account&&!state.pending;login.textContent=state.account?'Use another Google account':'Sign in with Google';logout.hidden=!state.account;
  upload.disabled=busy||!state.account||state.pending!==null||state.blocked||state.kinds.length===0;restore.disabled=busy||!state.account||state.kinds.length===0;
  const selectedRecord=state.slots.find(record=>record.kind===kind.value&&record.slot===Number(slot.value));
  // Unknown metadata must never be presented as an empty cloud slot.
  const slotsKnown=state.slotsLoaded===true;
  for(const card of slotButtons){const record=state.slots.find(item=>item.kind===kind.value&&item.slot===card.n);card.button.disabled=busy||state.kinds.length===0;card.button.setAttribute('aria-pressed',String(Number(slot.value)===card.n));card.name.textContent=slotName(kind.value,card.n);card.saved.textContent=record?'Saved copy':slotsKnown?'Empty slot':'Not checked';card.date.textContent=record?dateText(record.updatedAt):slotsKnown?'Ready for your first cloud save':'Refresh to view saved copies';card.button.setAttribute('aria-label',`${card.name.textContent}, ${card.saved.textContent}${record?', '+card.date.textContent:''}`);}
  availability.textContent=state.kinds.length===0?'Finish this field or return to your campaign to use cloud saves.':selectedRecord?`${slotName(kind.value,slot.value)} has a saved copy. Review it before replacing or loading it.`:slotsKnown?`${slotName(kind.value,slot.value)} is empty. Save a copy from this device to use it elsewhere.`:'Choose a slot. Its latest contents are checked before any transfer.';
  // Empty slots remain reviewable: a copy may have been saved by another device
  // since the account was refreshed, so a read is the authoritative answer.
  link.hidden=!(loginFallback&&state.loginURL);if(state.loginURL&&loginFallback)link.href=state.loginURL;else link.removeAttribute('href');
  recovery.hidden=!state.pending&&!state.blocked;reconcile.hidden=!state.pending;recoveryText.textContent=state.blocked?'A previous upload recovery copy could not be read. New uploads are paused to protect it. Keep this tab and its site data.':state.pending?`An upload to ${slotName(state.pending.kind,state.pending.slot)} needs verification. New uploads are paused. Keep this tab open, use the original Google account, and verify the saved copy.`:'';
  transferActions.hidden=!!state.review;confirm.hidden=cancel.hidden=preview.hidden=!state.review;session.hidden=true;
  if(state.review){const review=state.review,name=slotName(review.kind,review.slot),uploading=review.type==='upload';reviewTitle.textContent=uploading?`Save to ${name}?`:`Load ${name}?`;reviewContent.replaceChildren();if(uploading){reviewContent.append(copyCard('From this device',describeDocument(review.kind,review.captured.document)),copyCard(review.remote?`Replace ${name}`:`To ${name}`,review.remote?describeDocument(review.kind,review.remote.document):'Empty cloud slot.'));reviewEffect.textContent=`Only ${name} will change. Your device saves stay unchanged.`;}else{reviewContent.append(copyCard(`From ${name}`,describeDocument(review.kind,review.remote.document)));reviewEffect.textContent=review.plan?.effect??(review.kind==='wayfarer'?'This replaces your current Wayfarer charter session and restarts its field. Export the current charter first if you want to keep it.':review.kind==='decks'?'Next, review adding these saved decks in your deck workshop. No cards are unlocked and nothing is equipped automatically.':'Next, choose a new empty device slot or load for this session only. Existing device saves stay unchanged.');}
   const choices=review.plan?.choices;
   confirm.textContent=choices?.[0]?.label??(uploading?`Save to cloud slot ${review.slot}`:review.kind==='wayfarer'?'Replace this charter session':review.kind==='decks'?'Review downloaded decks':'Review downloaded campaign');
   confirm.disabled=busy||choices?.[0]?.disabled===true;
   const accept=(button,choice)=>run(()=>{if(!button.disabled&&model.snapshot().review===review)return model.confirm(choice,review);});
   confirm.onclick=accept(confirm,choices?.[0]?.id??null);
   if(choices?.[1]){session.hidden=false;session.textContent=choices[1].label;session.disabled=busy||choices[1].disabled===true;session.onclick=accept(session,choices[1].id);}
   cancel.textContent=uploading?'Cancel cloud save':'Keep current session';
   if(lastReview!==review&&active)preview.focus?.();
  }
  lastReview=state.review;
 });
 return {open(){if(disposed)return;active=true;return model.refresh();},leave(){active=false;endSignIn();model.leave();},dispose(){active=false;disposed=true;endSignIn();window?.removeEventListener?.('focus',onFocus);document.removeEventListener?.('visibilitychange',onVisibility);unsubscribe();model.leave();root.replaceChildren();root.hidden=true;}};
}
