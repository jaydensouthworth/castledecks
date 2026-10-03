/** Independently drawn, presentation-only guides for the sampled alternate modes.
 * The caller has already applied the world's uniform camera transform. Guide
 * coordinates are world units; strokes and ornament sizes below are CSS pixels.
 * No controller methods, trajectory solver, clock, or gameplay state are touched.
 */
const finite = Number.isFinite;
const TAU = Math.PI * 2;

/** Bounded preview of the primary carrier's fixed-step flight. Terrain and
 * actors can intercept it; this is a launch preview, not a promised hit. */
export function autoTrajectoryPoints(aim,target,{gravity=.3,segments=48}={}){
 const origin=aim?.origin,g=aim?.gravity??gravity;
 if(!aim?.canFire||![origin?.x,origin?.y,target?.x,aim.vx,aim.vy,g].every(finite)||Math.abs(aim.vx)<.001)return [];
 const ticks=(target.x-origin.x)/aim.vx;if(!(ticks>0&&ticks<=900))return [];
 const count=Math.max(2,Math.min(64,Math.trunc(segments)||48));
 return Array.from({length:count+1},(_,i)=>{const t=ticks*i/count;return{x:origin.x+aim.vx*t,y:origin.y+aim.vy*t+g*t*(t-1)/2};});
}

function outlinedStroke(ctx,color='#f9e5b6') {
  ctx.strokeStyle = '#17211de6';
  ctx.lineWidth = 4.5;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.75;
  ctx.stroke();
}

/** Draw the actual sampled guide, returning whether it was rendered.
 * `visible` is intentionally opt-in: the UI owns start/pause/menu/outcome gates.
 * Point rotation is in degrees and faces opposite the launch velocity; the
 * arrow therefore points along (-cos(rotation), -sin(rotation)). Auto mode's
 * reticle is only a sampled target location, never an impact/accuracy promise.
 * Like other Canvas helpers, this owns its current path; call between shapes.
 */
export function drawAlternateAimGuide(ctx, {
  mode, guide, scale, visible = false, blocked = false, trajectory = null,
} = {}) {
  if (visible !== true || (mode !== 'point_aim' && mode !== 'auto_aim')
    || !guide || !finite(guide.x) || !finite(guide.y) || !finite(guide.rotation)
    || !finite(scale) || scale <= 0) return false;
  const inverseScale = 1 / scale;
  if (!finite(inverseScale) || inverseScale <= 0
    || !finite(guide.x * scale) || !finite(guide.y * scale)) return false;
  const radians = guide.rotation * (Math.PI / 180);
  if (!finite(radians)) return false;

  ctx.save();
  try {
    if(mode==='auto_aim'&&!blocked){
      const points=autoTrajectoryPoints(trajectory,guide);
      if(points.length){ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const point of points.slice(1))ctx.lineTo(point.x,point.y);ctx.strokeStyle='#f9e5b688';ctx.lineWidth=1.3/scale;ctx.setLineDash([3/scale,6/scale]);ctx.stroke();}
    }
    ctx.translate(guide.x, guide.y);
    ctx.scale(inverseScale, inverseScale);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (mode === 'point_aim') {
      // The controller's negative cosine/sine convention is intentional,
      // including its vertical-axis behavior. Do not recompute from pointer.
      ctx.rotate(Math.atan2(-Math.sin(radians), -Math.cos(radians)));
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(43, 0);
      ctx.moveTo(35, -5);
      ctx.lineTo(43, 0);
      ctx.lineTo(35, 5);
      outlinedStroke(ctx);
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, TAU);
      outlinedStroke(ctx);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, TAU);
      for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(x * 11, y * 11);
        ctx.lineTo(x * 15, y * 15);
      }
      const color=blocked?'#ffab9b':'#f9e5b6';
      outlinedStroke(ctx,color);
      if(blocked){ctx.beginPath();ctx.moveTo(-7,7);ctx.lineTo(7,-7);outlinedStroke(ctx,color);}
      ctx.beginPath();
      ctx.arc(0, 0, 1.25, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();
    }
  } finally {
    ctx.restore();
  }
  return true;
}
