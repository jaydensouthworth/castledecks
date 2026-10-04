/** Geometry belongs to one frame, never to individual workspace content.
 * This adapter deliberately leaves battle, save, and return state in battle.mjs. */
export const MANAGEMENT_PANELS=Object.freeze(['intro','shopPanel','skillsPanel','queuePanel','campaignPanel','expeditionPanel','skirmishPanel','settingsPanel','profilesPanel','savePanel']);
export function mountManagementFrame(document){
 const frame=document.querySelector('#managementFrame');
 const panels=MANAGEMENT_PANELS.map(id=>document.querySelector('#'+id)).filter(Boolean);
 for(const panel of panels)frame.appendChild(panel);
 return {sync(openPanelId){
  const active=openPanelId?panels.find(panel=>'#'+panel.id===openPanelId):panels.find(panel=>panel.id==='intro'&&!panel.classList.contains('hidden'));
  frame.classList.toggle('hidden',!active);
  frame.setAttribute('data-workspace',active?.id??'none');
  for(const panel of panels){
   const covered=panel!==active;
   panel.classList.toggle('workspace-covered',covered);
   panel.setAttribute('aria-hidden',String(covered));
  }
 }};
}
