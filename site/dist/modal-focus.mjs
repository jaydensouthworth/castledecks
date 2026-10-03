/** Focus targets in the currently usable layer of a modal. An inert subtree
 * still has visible rectangles, but the browser cannot focus its controls. */
export function modalFocusCandidates(root){
 if(!root?.querySelectorAll)return [];
 return [...root.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex="0"]')].filter(node=>{
  if(node.disabled||node.matches?.(':disabled')||node.getAttribute?.('aria-disabled')==='true')return false;
  const tabindex=node.getAttribute?.('tabindex');if(tabindex!=null&&Number(tabindex)<0)return false;
  for(let ancestor=node;ancestor;ancestor=ancestor.parentElement){
   if(ancestor.inert||ancestor.getAttribute?.('inert')!=null||ancestor.hidden)return false;
  }
  return !!node.getClientRects?.().length;
 });
}
