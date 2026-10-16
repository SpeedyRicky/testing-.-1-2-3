import { describe, expect, it } from "vitest";
import { GROUND_Y, body, ghostPos, newRunner, runReward, step, type Input, type Level, type RunnerState } from "./runner/engine";
import { YABA_NIGHT_DASH } from "./runner/levels";

const DT = 1 / 60;
const idle: Input = { left: false, right: false, jump: false, slide: false };
const flat = (extra: Partial<Level> = {}): Level => ({
  id: "t", title: "t", gateLabel: "t", length: 2000, ground: [[0, 2000]], platforms: [], cables: [], ghosts: [], coins: [], stamps: [], gateX: 1900, ...extra,
});
const run = (s: RunnerState, input: Input, seconds: number) => {
  const ev: string[] = [];
  for (let i = 0; i < seconds * 60; i++) ev.push(...step(s, input, DT));
  return ev;
};

/** A simple bot: runs right, jumps before cables, pits and high ghosts, slides under low ones. */
function bot(s: RunnerState): Input {
  const L = s.level, x = s.x;
  const ahead = (a: number, lo: number, hi: number) => a - x > lo && a - x < hi;
  const cable = L.cables.some((c) => ahead(c.x, 18, 70));
  const pit = L.ground.some(([, end], i) => i < L.ground.length - 1 && ahead(end, 4, 40));
  const low = L.ghosts.some((g) => { const p = ghostPos(g, s.t); return ahead(p.x, 0, 75) && p.y > GROUND_Y - 62; });
  // Hold jump through the rise (letting go early is a short hop).
  return { left: false, right: true, jump: ((cable || pit) && s.onGround) || (!s.onGround && s.vy < 0), slide: low && s.onGround && !cable && !pit };
}

describe("runner physics", () => {
  it("runs, jumps with a squash-and-stretch kick, and lands", () => {
    const s = newRunner(flat());
    run(s, { ...idle, right: true }, 0.5);
    expect(s.vx).toBeGreaterThan(200);
    const ev = run(s, { ...idle, right: true, jump: true }, 0.1);
    expect(ev).toContain("jump");
    expect(s.y).toBeLessThan(GROUND_Y);
    expect(run(s, { ...idle, right: true }, 1)).toContain("land");
    expect(s.onGround).toBe(true);
  });

  it("a short tap jumps lower than a held jump", () => {
    const peak = (hold: number) => {
      const s = newRunner(flat());
      let top = GROUND_Y;
      for (let i = 0; i < 60; i++) { step(s, { ...idle, jump: i < hold }, DT); top = Math.min(top, s.y); }
      return GROUND_Y - top;
    };
    expect(peak(3)).toBeLessThan(peak(30) * 0.6);
  });

  it("coyote time: you can still jump just after running off a ledge", () => {
    const s = newRunner(flat({ ground: [[0, 300], [500, 2000]] }));
    while (s.x < 300 + 14) step(s, { ...idle, right: true }, DT);
    expect(s.onGround).toBe(false);
    expect(run(s, { ...idle, right: true, jump: true }, 0.05)).toContain("jump");
  });

  it("cables and ghosts cost a heart once, then you're briefly safe; pits send you back", () => {
    const s = newRunner(flat({ cables: [{ x: 100, w: 40 }] }));
    const ev = run(s, { ...idle, right: true }, 1);
    expect(ev.filter((e) => e === "hurt")).toHaveLength(1);
    expect(s.hearts).toBe(2);
    const p = newRunner(flat({ ground: [[0, 200], [400, 2000]] }));
    const fell = run(p, { ...idle, right: true }, 2);
    expect(fell).toContain("fall");
    expect(p.hearts).toBeLessThan(3);
  });

  it("sliding shrinks you under a low ghost", () => {
    const s = newRunner(flat());
    run(s, { ...idle, right: true }, 0.4);
    step(s, { ...idle, right: true, slide: true }, DT);
    expect(body(s).h).toBeLessThan(30);
  });

  it("coins count once; three lost hearts end the run", () => {
    const s = newRunner(flat({ coins: [{ x: 120, y: GROUND_Y - 20 }] }));
    const ev = run(s, { ...idle, right: true }, 1);
    expect(ev.filter((e) => e === "coin")).toHaveLength(1);
    const d = newRunner(flat({ cables: [{ x: 60, w: 1800 }] }));
    expect(run(d, { ...idle, right: true }, 6)).toContain("over");
    expect(d.over).toBe(true);
  });
});

describe("Sector 1: Yaba Night Dash", () => {
  it("is beatable by a simple bot, start to checkpoint, in under a minute and a half", () => {
    const s = newRunner(YABA_NIGHT_DASH);
    let t = 0;
    while (!s.done && !s.over && t < 90) { step(s, bot(s), DT); t += DT; }
    expect(s.done).toBe(true);
    expect(s.hearts).toBeGreaterThan(0);
    expect(s.coins.size).toBeGreaterThan(10);
  });

  it("rewards JP and calm, never money, and caps them", () => {
    const r = runReward({ coins: new Set(Array.from({ length: 200 }, (_, i) => i)), stamps: new Set([0, 1, 2, 3]), hearts: 3, done: true });
    expect(r.jp).toBe(80);
    expect(r.effects).toEqual({ desperation: -12, energy: 9 });
    expect(Object.keys(r.effects)).not.toContain("walletCad");
    expect(runReward({ coins: new Set([1, 2, 3, 4, 5, 6]), stamps: new Set(), hearts: 0, done: false }).effects).toEqual({ desperation: -1, energy: 0 });
  });

  it("every pit can be jumped and every coin and stamp is reachable", () => {
    const L = YABA_NIGHT_DASH;
    for (let i = 1; i < L.ground.length; i++) expect(L.ground[i][0] - L.ground[i - 1][1]).toBeLessThanOrEqual(110);
    for (const c of [...L.coins, ...L.stamps]) expect(c.y).toBeGreaterThan(GROUND_Y - 175);
  });
});
