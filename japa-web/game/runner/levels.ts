// Runner levels. Sector 1: Yaba Night Dash, from your street to the Oga's office. Sectors 2-4 follow after play-testing.
import { GROUND_Y, type Level } from "./engine";

const row = (x: number, y: number, n: number, gap = 26) => Array.from({ length: n }, (_, i) => ({ x: x + i * gap, y }));
const arc = (x: number, n: number, top = GROUND_Y - 105) =>
  Array.from({ length: n }, (_, i) => ({ x: x + i * 26, y: top + Math.abs(i - (n - 1) / 2) * 16 }));
/** A danfo's roof: the bus is drawn below it. */
const danfo = (x: number) => ({ x, y: GROUND_Y - 62, w: 128, h: 10 });

export const YABA_NIGHT_DASH: Level = {
  id: "s1",
  title: "Yaba Night Dash",
  gateLabel: "Oga's office",
  length: 4100,
  ground: [[0, 900], [990, 1720], [1820, 2520], [2610, 3120], [3220, 4100]],
  platforms: [danfo(560), danfo(1290), danfo(2040), danfo(2790), danfo(3420)],
  cables: [{ x: 420, w: 44 }, { x: 1150, w: 44 }, { x: 1560, w: 52 }, { x: 2270, w: 44 }, { x: 2700, w: 44 }, { x: 3010, w: 52 }, { x: 3560, w: 44 }],
  ghosts: [
    { x: 800, y: GROUND_Y - 80, amp: 28, speed: 2.2, phase: 0 },
    { x: 1460, y: GROUND_Y - 54, amp: 10, speed: 2.8, phase: 1 },
    { x: 2180, y: GROUND_Y - 76, amp: 30, speed: 2.4, phase: 2 },
    { x: 2920, y: GROUND_Y - 54, amp: 10, speed: 3, phase: 0.5 },
    { x: 3700, y: GROUND_Y - 78, amp: 30, speed: 2.6, phase: 1.5 },
  ],
  coins: [
    ...row(180, GROUND_Y - 30, 5), ...arc(400, 5), ...row(575, GROUND_Y - 95, 4), ...arc(905, 4, GROUND_Y - 120),
    ...row(1050, GROUND_Y - 30, 4), ...arc(1135, 4), ...row(1305, GROUND_Y - 95, 4), ...row(1600, GROUND_Y - 30, 3),
    ...arc(1735, 4, GROUND_Y - 120), ...row(1900, GROUND_Y - 30, 5), ...row(2055, GROUND_Y - 95, 4), ...arc(2255, 4),
    ...arc(2525, 4, GROUND_Y - 120), ...row(2805, GROUND_Y - 95, 4), ...arc(2995, 5), ...arc(3125, 4, GROUND_Y - 120),
    ...row(3300, GROUND_Y - 30, 4), ...row(3435, GROUND_Y - 95, 4), ...arc(3545, 4), ...row(3850, GROUND_Y - 30, 5),
  ],
  stamps: [{ x: 624, y: GROUND_Y - 140 }, { x: 1770, y: GROUND_Y - 150 }, { x: 2856, y: GROUND_Y - 140 }, { x: 3168, y: GROUND_Y - 150 }],
  gateX: 3980,
};

export const LEVELS: Record<string, Level> = { s1: YABA_NIGHT_DASH };

/** Which story scene each sector's checkpoint gate opens. */
export const GATES: Record<string, string> = { LAGOS_OGA: "s1" };
