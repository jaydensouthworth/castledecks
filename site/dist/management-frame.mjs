/** Geometry belongs to one frame, never to individual workspace content.
 * This adapter deliberately leaves battle, save, and return state in battle.mjs. */
export const MANAGEMENT_PANELS=Object.freeze(['intro','shopPanel','skillsPanel','queuePanel','campaignPanel','expeditionPanel','skirmishPanel','settingsPanel','profilesPanel','savePanel']);
export function revealManagementRoute(nav){
 const current=nav?.querySelector('[aria-current="page"]');
 if(!current||!nav.getBoundingClientRect||!current.getBoundingClientRect)return;
 const rail=nav.getBoundingClientRect(),item=current.getBoundingClientRect();
 if(!rail.width||!rail.height)return;
 if(item.top<rail.top)nav.scrollTop+=item.top-rail.top;
 else if(item.bottom>rail.bottom)nav.scrollTop+=item.bottom-rail.bottom;
 if(item.left<rail.left)nav.scrollLeft+=item.left-rail.left;
 else if(item.right>rail.right)nav.scrollLeft+=item.right-rail.right;
}
export function mountManagementFrame(document){
 const frame=document.querySelector('#managementFrame');
 const panels=MANAGEMENT_PANELS.map(id=>document.querySelector('#'+id)).filter(Boolean);
 for(const panel of panels)frame.appendChild(panel);
 let activeNav=null,activePanel=null,scrollTop=0,scrollLeft=0;
 return {
 captureNavigation(){if(activeNav&&!frame.classList.contains('hidden')){scrollTop=activeNav.scrollTop||0;scrollLeft=activeNav.scrollLeft||0;}},
 keepNavigationVisible(){revealManagementRoute(activeNav);},
 sync(openPanelId){
  const active=openPanelId?panels.find(panel=>'#'+panel.id===openPanelId):panels.find(panel=>panel.id==='intro'&&!panel.classList.contains('hidden'));
  frame.classList.toggle('hidden',!active);
  frame.setAttribute('data-workspace',active?.id??'none');
  for(const panel of panels){
   const covered=panel!==active;
   panel.classList.toggle('workspace-covered',covered);
   panel.setAttribute('aria-hidden',String(covered));
  }
  const nav=active?.querySelector('.game-shell-nav');
  if(active!==activePanel&&nav){nav.scrollTop=scrollTop;nav.scrollLeft=scrollLeft;}
  activePanel=active;activeNav=nav;revealManagementRoute(nav);
 }};
}
