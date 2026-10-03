/** Event-driven presentation only. Session, save and battle ownership stay in battle.mjs. */
export function syncCommandHall({document,selected,activeDestination,selectedDestination,started,summary}) {
 const hall=document.querySelector('#intro'),drawer=document.querySelector('#hallDestinationDrawer');
 if(!hall||!selected)return;
 if(drawer)drawer.onkeydown=event=>{if(event.key==='Escape'&&drawer.open){drawer.open=false;drawer.querySelector('summary')?.focus?.();event.stopPropagation?.();event.preventDefault?.();}};
 const previous=hall.getAttribute('data-selected-destination');
 hall.setAttribute('data-selected-destination',selectedDestination);
 hall.setAttribute('data-active-destination',activeDestination);
 hall.setAttribute('data-session-phase',summary?'settled':started?'paused':'ready');
 const name=document.querySelector('#hallSelectedName'),kind=document.querySelector('#hallSelectedKind');
 if(name)name.textContent=selected.name;if(kind)kind.textContent=selected.kind;
 if(drawer&&previous&&previous!==selectedDestination){drawer.open=false;document.querySelector('#start')?.focus?.();}
}
