/** Painted geometry and interaction eligibility are deliberately separate:
 * inert HUD surfaces still occupy pixels and must remain in occlusion totals. */
export function paintedVisible(node,win){
 if(!node?.getClientRects().length)return false;
 for(let parent=node;parent;parent=parent.parentElement){const style=win.getComputedStyle(parent);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;}
 return true;
}
const firstSummary=details=>[...details.children].find(child=>child.tagName==='SUMMARY');

/** Disabled controls keep their existing diagnostic treatment. A disclosure's
 * first direct summary (and its descendants) remains exposed while closed;
 * every enclosing disclosure must also expose the branch containing the node. */
export function interactionVisible(node,win){
 if(!paintedVisible(node,win))return false;
 if(node.tagName==='SUMMARY'&&(node.parentElement?.tagName!=='DETAILS'||firstSummary(node.parentElement)!==node))return false;
 let branch=null;
 for(let parent=node;parent;branch=parent,parent=parent.parentElement){
  if(parent.inert||parent.getAttribute('inert')!==null||parent.hidden)return false;
  if(branch&&parent.tagName==='DETAILS'&&!parent.open&&firstSummary(parent)!==branch)return false;
 }
 return true;
}
