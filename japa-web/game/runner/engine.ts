// The 2D runner between story chapters: pure physics and level logic, so it's unit-tested without a canvas.
// World units are pixels at the reference height (VIEW_H); the canvas scales them to fit.
//
// step() mutates the state it is given (it runs 60 times a second) and returns what happened, for sounds and effects.

export const VIEW_H = 270;
export const GROUND_Y = 222;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Level {
  id: string;
  title: string;
  /** The story scene the checkpoint gate opens. */
  gateLabel: string;
  length: number;
  /** Solid ground, as [from, to] spans; gaps between them are pits. */
  ground: [number, number][];
  /** One-way platforms (danfo roofs, stall awnings): land on them from above. */
  platforms: Rect[];
  /** Sparking NEPA cables on the ground: jump over them. */
  cables: { x: number; w: number }[];
  /** Village People stress ghosts: float on a sine wave. */
  ghosts: { x: number; y: number; amp: number; speed: number; phase: number }[];
  coins: { x: number; y: number }[];
  stamps: { x: number; y: number }[];
  gateX: number;
}

export interface Input { left: boolean; right: boolean; jump: boolean; slide: boolean }

export interface RunnerState {
  level: Level;
  t: number;
  x: number; y: number; vx: number; vy: number;
  facing: 1 | -1;
  onGround: boolean;
  sliding: number;
  coyote: number;
  buffer: number;
  jumpHeld: boolean;
  hearts: number;
  invuln: number;
  lastSafeX: number;
  coins: Set<number>;
  stamps: Set<number>;
  done: boolean;
  over: boolean;
  /** Squash and stretch: 1 is normal; >1 tall and thin (jumping), <1 short and wide (landing). */
  stretch: number;
  stretchV: number;
  runPhase: number;
}

export type RunnerEvent = "jump" | "land" | "coin" | "stamp" | "hurt" | "fall" | "clear" | "over";

export const PLAYER = { w: 22, h: 46, slideH: 26 };
const G = 2300, JUMP_V = 770, MAX_RUN = 265, ACCEL_GROUND = 1900, ACCEL_AIR = 1150, FRICTION = 2200;
const COYOTE = 0.1, BUFFER = 0.13, CUT_V = 320, SLIDE_TIME = 0.55, INVULN = 1.3;

export function newRunner(level: Level): RunnerState {
  return {
    level, t: 0, x: 40, y: GROUND_Y, vx: 0, vy: 0, facing: 1, onGround: true, sliding: 0, coyote: 0, buffer: 0,
    jumpHeld: false, hearts: 3, invuln: 0, lastSafeX: 40, coins: new Set(), stamps: new Set(), done: false, over: false,
    stretch: 1, stretchV: 0, runPhase: 0,
  };
}

/** The player's body box: x is the centre, y the feet. */
export function body(s: RunnerState): Rect {
  const h = s.sliding > 0 ? PLAYER.slideH : PLAYER.h;
  const w = s.sliding > 0 ? PLAYER.w + 10 : PLAYER.w;
  return { x: s.x - w / 2, y: s.y - h, w, h };
}

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function ghostPos(g: Level["ghosts"][number], t: number) {
  return { x: g.x + Math.sin(t * g.speed * 0.5 + g.phase) * 18, y: g.y + Math.sin(t * g.speed + g.phase) * g.amp };
}

function groundAt(level: Level, x: number): boolean {
  return level.ground.some(([a, b]) => x >= a && x <= b);
}

/** One fixed step (dt seconds). Mutates `s`; returns what happened this step. */
export function step(s: RunnerState, input: Input, dt: number): RunnerEvent[] {
  const ev: RunnerEvent[] = [];
  if (s.done || s.over) return ev;
  const L = s.level;
  s.t += dt;
  s.invuln = Math.max(0, s.invuln - dt);
  s.sliding = Math.max(0, s.sliding - dt);

  // Run.
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) {
    s.facing = dir > 0 ? 1 : -1;
    s.vx += dir * (s.onGround ? ACCEL_GROUND : ACCEL_AIR) * dt;
  } else if (s.onGround) {
    const f = FRICTION * dt;
    s.vx = Math.abs(s.vx) <= f ? 0 : s.vx - Math.sign(s.vx) * f;
  }
  const max = s.sliding > 0 ? MAX_RUN * 1.15 : MAX_RUN;
  s.vx = Math.max(-max, Math.min(max, s.vx));

  // Slide: only on the ground, keeps your speed.
  if (input.slide && s.onGround && s.sliding <= 0 && Math.abs(s.vx) > 60) s.sliding = SLIDE_TIME;

  // Jump: buffered presses and a little coyote time after leaving a ledge; let go early for a short hop.
  if (input.jump && !s.jumpHeld) s.buffer = BUFFER;
  else s.buffer = Math.max(0, s.buffer - dt);
  s.coyote = s.onGround ? COYOTE : Math.max(0, s.coyote - dt);
  if (s.buffer > 0 && s.coyote > 0) {
    s.vy = -JUMP_V;
    s.onGround = false;
    s.coyote = 0;
    s.buffer = 0;
    s.sliding = 0;
    s.stretchV = 6;
    ev.push("jump");
  }
  if (!input.jump && s.jumpHeld && s.vy < -CUT_V) s.vy = -CUT_V;
  s.jumpHeld = input.jump;

  // Move and collide.
  const prevY = s.y;
  s.vy += G * dt;
  s.x = Math.max(12, Math.min(L.length - 12, s.x + s.vx * dt));
  s.y += s.vy * dt;
  const wasGround = s.onGround;
  s.onGround = false;
  if (s.vy >= 0) {
    const half = PLAYER.w / 2 - 3;
    if (prevY <= GROUND_Y + 0.5 && s.y >= GROUND_Y && (groundAt(L, s.x - half) || groundAt(L, s.x + half))) {
      s.y = GROUND_Y; s.vy = 0; s.onGround = true;
    }
    for (const p of L.platforms) {
      if (s.x + half > p.x && s.x - half < p.x + p.w && prevY <= p.y + 0.5 && s.y >= p.y) {
        s.y = p.y; s.vy = 0; s.onGround = true;
      }
    }
  }
  if (s.onGround && !wasGround) { s.stretchV = -7; ev.push("land"); }
  if (s.onGround && s.y === GROUND_Y && groundAt(L, s.x)) s.lastSafeX = s.x;
  s.runPhase += Math.abs(s.vx) * dt * 0.06;

  // Squash and stretch: a damped spring back to 1.
  s.stretch += s.stretchV * dt;
  s.stretchV += (-(s.stretch - 1) * 120 - s.stretchV * 14) * dt;
  if (!s.onGround) s.stretch = Math.max(0.85, Math.min(1.2, s.stretch + (s.vy < 0 ? 0.004 : -0.002)));

  const b = body(s);
  // Collect.
  L.coins.forEach((c, i) => {
    if (!s.coins.has(i) && overlap(b, { x: c.x - 9, y: c.y - 9, w: 18, h: 18 })) { s.coins.add(i); ev.push("coin"); }
  });
  L.stamps.forEach((c, i) => {
    if (!s.stamps.has(i) && overlap(b, { x: c.x - 12, y: c.y - 12, w: 24, h: 24 })) { s.stamps.add(i); ev.push("stamp"); }
  });

  // Hazards.
  const hurt = () => {
    if (s.invuln > 0) return;
    s.hearts -= 1;
    s.invuln = INVULN;
    s.vy = -420;
    s.vx = -s.facing * 160;
    s.onGround = false;
    ev.push("hurt");
  };
  for (const c of L.cables) if (overlap(b, { x: c.x, y: GROUND_Y - 16, w: c.w, h: 16 })) hurt();
  for (const g of L.ghosts) {
    const p = ghostPos(g, s.t);
    if (overlap(b, { x: p.x - 13, y: p.y - 13, w: 26, h: 26 })) hurt();
  }
  // Pits: fall in, lose a heart, back to the last safe ground.
  if (s.y > VIEW_H + 60) {
    s.hearts -= 1;
    ev.push("fall");
    // Back on solid ground with a run-up, not on the edge you just fell from.
    const seg = L.ground.find(([a, z]) => s.lastSafeX >= a && s.lastSafeX <= z) ?? L.ground[0];
    s.x = Math.max(seg[0] + 30, s.lastSafeX - 150); s.y = GROUND_Y; s.vx = 0; s.vy = 0; s.onGround = true; s.invuln = INVULN;
  }
  if (s.hearts <= 0) { s.over = true; ev.push("over"); return ev; }
  if (s.x >= L.gateX) { s.done = true; ev.push("clear"); }
  return ev;
}

/** What a finished (or abandoned) run is worth. Coins never become proof of funds: they buy JP and calm. */
export function runReward(s: Pick<RunnerState, "coins" | "stamps" | "hearts" | "done">) {
  const coins = s.coins.size, stamps = s.stamps.size;
  const jp = Math.min(80, coins + stamps * 5 + (s.done ? 10 : 0));
  const calm = s.done ? Math.min(12, Math.floor(coins / 4) + stamps * 2) : Math.min(6, Math.floor(coins / 6));
  const energy = s.done ? Math.max(0, s.hearts) * 3 : 0;
  return { coins, stamps, jp, effects: { desperation: -calm, energy } };
}
