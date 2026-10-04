/** Presentation-only: keep portrait thumb controls just above the actual dock.
 * The dock can have one or two skill rows, a companion, and company controls.
 * Never derive this from equipped count: native fonts/content own the height. */
export function syncPortraitDock(root, {width, height}) {
 if (!(width < height)) return null;
 const hud=root.querySelector('.live-hud'),dock=root.querySelector('.live-arsenal');
 if (!hud || !dock) return null;
 const measured=dock.getBoundingClientRect().height;
 if (!Number.isFinite(measured) || measured <= 0 || measured > height) return null;
 const value=Math.ceil(measured)+'px';
 if(hud.dataset.portraitDockHeight!==value){
  hud.style.setProperty?.('--portrait-dock-height',value);
  hud.dataset.portraitDockHeight=value;
 }
 return Math.ceil(measured);
}
