/** Random rolls for one move, in [0, 1). Kept outside components so they stay pure;
 *  the engine takes rolls as arguments, which keeps every rule testable. */
export function rolls(): [number, number] {
  return [Math.random(), Math.random()];
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

export function pickFrom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
