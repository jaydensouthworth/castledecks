/** Fixed-rate simulation scheduler. BowMaster's authored rate is 33 Hz.
 * This module is independently written; no Flash runtime is used.
 * Rendering cadence must not alter the simulation's discrete update count.
 */
export const TICK_HZ = 33;
export const TICK_SECONDS = 1 / TICK_HZ;
export class SimulationClock {
  constructor({onTick=()=>{}, maxCatchUpTicks=330}={}) {
    this.onTick=onTick;
    this.maxCatchUpTicks=maxCatchUpTicks;
    this.accumulator=0;
    this.tick=0;
    this.paused=false;
  }
  advance(elapsedSeconds) {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds<0) throw new RangeError('Elapsed time must be finite and nonnegative');
    if (this.paused) return 0;
    this.accumulator+=elapsedSeconds;
    let count=0;
    while(this.accumulator+1e-12>=TICK_SECONDS && count<this.maxCatchUpTicks) {
      this.onTick(this.tick++);
      this.accumulator-=TICK_SECONDS;
      count++;
    }
    if (Math.abs(this.accumulator)<1e-12) this.accumulator=0;
    return count;
  }
  get interpolation() { return Math.min(1, Math.max(0,this.accumulator/TICK_SECONDS)); }
  reset() {this.accumulator=0;this.tick=0;}
}
