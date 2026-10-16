// Canvas drawing for the runner: a cartoon Lagos dusk, danfo buses, sparking cables, Village People ghosts,
// coins, stamps, the checkpoint gate, and the player in their own colours with flowing robes and squash-and-stretch.
import { GROUND_Y, VIEW_H, ghostPos, type RunnerState } from "@/game/runner/engine";
import type { Avatar } from "@/game/profile";

const rand = (i: number) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

function sky(ctx: CanvasRenderingContext2D, w: number) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, "#1e1b4b"); g.addColorStop(0.45, "#6d28d9"); g.addColorStop(0.8, "#f97316"); g.addColorStop(1, "#fbbf24");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, GROUND_Y);
  ctx.fillStyle = "#fde68a"; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(w * 0.78, GROUND_Y - 70, 26, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

/** Two layers of rooftops and water tanks, scrolling slower than the street. */
function skyline(ctx: CanvasRenderingContext2D, cam: number, w: number, t: number) {
  for (const [speed, color, base] of [[0.2, "#3b0764", 70], [0.45, "#1f0a3a", 40]] as const) {
    ctx.fillStyle = color;
    const off = cam * speed;
    for (let i = Math.floor(off / 60) - 1; i < (off + w) / 60 + 1; i++) {
      const bw = 40 + rand(i * 3 + speed * 10) * 40, bh = base + rand(i * 7 + speed) * 70;
      const x = i * 60 - off;
      ctx.fillRect(x, GROUND_Y - bh, bw, bh);
      if (speed > 0.3) {
        // Lit windows, some flickering when NEPA struggles.
        for (let k = 0; k < 4; k++) {
          if (rand(i * 11 + k) > 0.55 && Math.sin(t * 3 + i + k) > -0.6) {
            ctx.fillStyle = "#fcd34d"; ctx.fillRect(x + 6 + (k % 2) * 16, GROUND_Y - bh + 10 + Math.floor(k / 2) * 18, 8, 8); ctx.fillStyle = color;
          }
        }
      }
    }
  }
  // Electric poles with sagging cables.
  ctx.strokeStyle = "#111827"; ctx.lineWidth = 3;
  const off = cam * 0.8;
  for (let i = Math.floor(off / 260) - 1; i < (off + w) / 260 + 1; i++) {
    const x = i * 260 - off;
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GROUND_Y - 120); ctx.moveTo(x - 14, GROUND_Y - 112); ctx.lineTo(x + 14, GROUND_Y - 112); ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y - 112); ctx.quadraticCurveTo(x + 130, GROUND_Y - 80, x + 260, GROUND_Y - 112); ctx.stroke();
    ctx.lineWidth = 3;
  }
}

function street(ctx: CanvasRenderingContext2D, s: RunnerState, cam: number, w: number) {
  for (const [a, b] of s.level.ground) {
    const x = a - cam, ww = b - a;
    if (x > w || x + ww < 0) continue;
    ctx.fillStyle = "#292524"; ctx.fillRect(x, GROUND_Y, ww, VIEW_H - GROUND_Y);
    ctx.fillStyle = "#57534e"; ctx.fillRect(x, GROUND_Y, ww, 6);
    ctx.fillStyle = "#facc15";
    for (let k = Math.ceil(a / 60) * 60; k < b - 20; k += 60) ctx.fillRect(k - cam, GROUND_Y + 22, 26, 4);
  }
  // Pits: a gutter with a glint of water.
  ctx.fillStyle = "#0c4a6e";
  for (let i = 1; i < s.level.ground.length; i++) {
    const a = s.level.ground[i - 1][1], b = s.level.ground[i][0];
    ctx.fillRect(a - cam, VIEW_H - 14, b - a, 14);
  }
}

function danfo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const top = y, bottom = GROUND_Y - 10;
  ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.roundRect(x, top, w, bottom - top, 10); ctx.fill();
  ctx.fillStyle = "#111827"; ctx.fillRect(x, top + 24, w, 6); ctx.fillRect(x, top + 36, w, 4);
  ctx.fillStyle = "#93c5fd";
  for (let k = 0; k < 4; k++) ctx.fillRect(x + 10 + k * 28, top + 6, 20, 14);
  ctx.fillStyle = "#111827";
  for (const wx of [x + 22, x + w - 22]) { ctx.beginPath(); ctx.arc(wx, bottom, 10, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#9ca3af";
  for (const wx of [x + 22, x + w - 22]) { ctx.beginPath(); ctx.arc(wx, bottom, 4, 0, Math.PI * 2); ctx.fill(); }
}

function cable(ctx: CanvasRenderingContext2D, x: number, w: number, t: number) {
  ctx.strokeStyle = "#111827"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x - 6, GROUND_Y - 2);
  for (let k = 0; k <= 6; k++) ctx.lineTo(x + (w * k) / 6, GROUND_Y - 6 - Math.sin(k * 1.7 + t * 6) * 3);
  ctx.stroke();
  // Sparks.
  for (let k = 0; k < 6; k++) {
    const p = (t * 3 + k * 0.37) % 1;
    const sx = x + rand(k + Math.floor(t * 3)) * w, sy = GROUND_Y - 8 - p * 22;
    ctx.fillStyle = k % 2 ? "#fde047" : "#ffffff"; ctx.globalAlpha = 1 - p;
    ctx.fillRect(sx, sy, 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.moveTo(x + w / 2, GROUND_Y - 40); ctx.lineTo(x + w / 2 - 9, GROUND_Y - 25); ctx.lineTo(x + w / 2 + 9, GROUND_Y - 25); ctx.fill();
  ctx.fillStyle = "#111827"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", x + w / 2, GROUND_Y - 28);
}

function ghost(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.fillStyle = "rgba(168, 85, 247, 0.85)";
  ctx.beginPath(); ctx.arc(x, y - 4, 14, Math.PI, 0);
  for (let k = 0; k <= 4; k++) ctx.lineTo(x + 14 - k * 7, y + 12 + (k % 2 ? -4 : 2) + Math.sin(t * 8 + k) * 1.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x - 5, y - 6, 4, 5, 0, 0, Math.PI * 2); ctx.ellipse(x + 5, y - 6, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1e1b4b"; ctx.beginPath(); ctx.arc(x - 6, y - 5, 2, 0, Math.PI * 2); ctx.arc(x + 4, y - 5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1e1b4b"; ctx.font = "bold 7px sans-serif"; ctx.textAlign = "center"; ctx.fillText("VP", x, y + 6);
}

function coin(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const sx = Math.abs(Math.cos(t * 4 + x * 0.01));
  ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.ellipse(x, y, 8 * Math.max(0.25, sx), 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.ellipse(x, y, 5.5 * Math.max(0.2, sx), 5.5, 0, 0, Math.PI * 2); ctx.fill();
  if (sx > 0.5) { ctx.fillStyle = "#92400e"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.fillText("₦", x, y + 3); }
}

function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const bob = Math.sin(t * 3 + x) * 3;
  ctx.save(); ctx.translate(x, y + bob); ctx.rotate(Math.sin(t * 2) * 0.15);
  ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 5); ctx.fill();
  ctx.strokeStyle = "#bbf7d0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-8, -8, 16, 16, 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-1, 4); ctx.lineTo(5, -4); ctx.stroke();
  ctx.restore();
}

function gate(ctx: CanvasRenderingContext2D, x: number, label: string, t: number) {
  ctx.fillStyle = "#14532d"; ctx.fillRect(x - 6, GROUND_Y - 120, 10, 120); ctx.fillRect(x + 74, GROUND_Y - 120, 10, 120);
  ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.roundRect(x - 14, GROUND_Y - 140, 106, 28, 8); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("CHECKPOINT", x + 39, GROUND_Y - 128); ctx.font = "bold 9px sans-serif"; ctx.fillText(label.toUpperCase(), x + 39, GROUND_Y - 117);
  for (let k = 0; k < 5; k++) {
    ctx.fillStyle = k % 2 ? "#ffffff" : "#16a34a";
    ctx.beginPath(); ctx.moveTo(x - 10 + k * 22, GROUND_Y - 112); ctx.lineTo(x + k * 22, GROUND_Y - 100 + Math.sin(t * 6 + k) * 2); ctx.lineTo(x + 10 + k * 22, GROUND_Y - 112); ctx.fill();
  }
}

/** The player: big head, expressive eyes, robe and cape that flap with speed, bouncy legs, squash and stretch. */
function player(ctx: CanvasRenderingContext2D, s: RunnerState, x: number, av: Avatar) {
  if (s.invuln > 0 && Math.floor(s.t * 14) % 2 === 0) return;
  const sliding = s.sliding > 0;
  const sy = sliding ? 0.6 : s.stretch, sx = 1 / Math.sqrt(sy);
  const speed = Math.min(1, Math.abs(s.vx) / 265);
  ctx.save();
  ctx.translate(x, s.y);
  ctx.scale(s.facing * sx, sy);
  const robe = av.outfitColor;
  const dark = "rgba(0,0,0,0.25)";
  // Cape: a flag behind the body that ripples with speed.
  ctx.fillStyle = robe;
  ctx.beginPath(); ctx.moveTo(-4, -38);
  for (let k = 1; k <= 5; k++) ctx.lineTo(-6 - k * (3 + speed * 4), -36 + k * 6 + Math.sin(s.t * 14 - k) * (2 + speed * 4));
  ctx.lineTo(-4, -8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark; ctx.fill();
  // Legs.
  const swing = s.onGround ? Math.sin(s.runPhase) * 10 * speed : 6;
  ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-3, -12); ctx.lineTo(-3 + swing, 0); ctx.moveTo(3, -12); ctx.lineTo(3 - swing, s.onGround ? 0 : -4); ctx.stroke();
  // Robe (agbada or ankara): a flared body with a zigzag pattern.
  ctx.fillStyle = robe;
  ctx.beginPath(); ctx.moveTo(-9, -38); ctx.lineTo(9, -38); ctx.lineTo(13 + speed * 2, -10); ctx.lineTo(-13 - speed * 2, -10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 0; k < 5; k++) ctx.lineTo(-11 + k * 5.5, -18 + (k % 2 ? -4 : 0));
  ctx.stroke();
  // Arms pump with the legs.
  ctx.strokeStyle = av.skin; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(6, -33); ctx.lineTo(10 - swing * 0.6, -22); ctx.stroke();
  // Head.
  ctx.fillStyle = av.skin; ctx.beginPath(); ctx.arc(0, -48, 11, 0, Math.PI * 2); ctx.fill();
  if (av.hair !== "bald") { ctx.fillStyle = av.hairColor; ctx.beginPath(); ctx.arc(0, -50, 11, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); }
  if (av.headwear === "gele") { ctx.fillStyle = av.headwearColor; ctx.beginPath(); ctx.ellipse(0, -60, 14, 7, -0.2, 0, Math.PI * 2); ctx.fill(); }
  if (av.headwear === "fila") { ctx.fillStyle = av.headwearColor; ctx.beginPath(); ctx.moveTo(-10, -56); ctx.lineTo(8, -56); ctx.lineTo(12, -64); ctx.lineTo(-6, -63); ctx.fill(); }
  // Eyes: big, looking where you're going; X when hurt; blinking.
  const blink = Math.sin(s.t * 1.7) > 0.985;
  const look = Math.max(-1.5, Math.min(2, s.vy / 300));
  if (s.invuln > 0.8) {
    ctx.strokeStyle = "#111827"; ctx.lineWidth = 1.8;
    for (const ex of [1, 7]) { ctx.beginPath(); ctx.moveTo(ex - 2, -51); ctx.lineTo(ex + 2, -47); ctx.moveTo(ex + 2, -51); ctx.lineTo(ex - 2, -47); ctx.stroke(); }
  } else {
    ctx.fillStyle = "#fff";
    for (const ex of [1.5, 7.5]) { ctx.beginPath(); ctx.ellipse(ex, -49, 3.2, blink ? 0.6 : 3.8, 0, 0, Math.PI * 2); ctx.fill(); }
    if (!blink) { ctx.fillStyle = "#111827"; for (const ex of [2.6, 8.6]) { ctx.beginPath(); ctx.arc(ex, -49 + look, 1.6, 0, Math.PI * 2); ctx.fill(); } }
  }
  if (av.glasses) { ctx.strokeStyle = "#111827"; ctx.lineWidth = 1; for (const ex of [1.5, 7.5]) { ctx.beginPath(); ctx.arc(ex, -49, 4.4, 0, Math.PI * 2); ctx.stroke(); } }
  // Mouth: a grin running, an "o" in the air.
  ctx.strokeStyle = "#7f1d1d"; ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (!s.onGround) ctx.arc(5, -42, 1.8, 0, Math.PI * 2); else ctx.arc(5, -44, 3, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();
}

export function drawFrame(ctx: CanvasRenderingContext2D, s: RunnerState, w: number, av: Avatar, sparkle: { x: number; y: number; t: number }[]) {
  const cam = Math.max(0, Math.min(s.level.length - w, s.x - w * 0.35));
  sky(ctx, w);
  skyline(ctx, cam, w, s.t);
  street(ctx, s, cam, w);
  const L = s.level;
  for (const p of L.platforms) if (p.x - cam < w && p.x + p.w - cam > 0) danfo(ctx, p.x - cam, p.y, p.w);
  for (const c of L.cables) if (c.x - cam < w + 20 && c.x + c.w - cam > -20) cable(ctx, c.x - cam, c.w, s.t);
  gate(ctx, L.gateX - cam, L.gateLabel, s.t);
  L.coins.forEach((c, i) => { if (!s.coins.has(i) && c.x - cam > -10 && c.x - cam < w + 10) coin(ctx, c.x - cam, c.y, s.t); });
  L.stamps.forEach((c, i) => { if (!s.stamps.has(i) && c.x - cam > -14 && c.x - cam < w + 14) stamp(ctx, c.x - cam, c.y, s.t); });
  for (const g of L.ghosts) { const p = ghostPos(g, s.t); if (p.x - cam > -20 && p.x - cam < w + 20) ghost(ctx, p.x - cam, p.y, s.t); }
  player(ctx, s, s.x - cam, av);
  // Pickup sparkles.
  for (const sp of sparkle) {
    const age = s.t - sp.t;
    ctx.fillStyle = "#fde68a"; ctx.globalAlpha = Math.max(0, 1 - age * 2.5);
    for (let k = 0; k < 6; k++) { const a = k * 1.05; ctx.fillRect(sp.x - cam + Math.cos(a) * age * 60, sp.y + Math.sin(a) * age * 60, 3, 3); }
  }
  ctx.globalAlpha = 1;
}
