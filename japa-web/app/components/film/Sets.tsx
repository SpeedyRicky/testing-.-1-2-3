// The film's sets, drawn flat in SVG on a 1600 x 900 frame with the floor at about y = 800.
// Each set has three depth layers (far, mid, near) so camera moves get parallax.
import type { ReactNode } from "react";

export type SetKind =
  | "lagos-street" | "bedroom" | "cafe" | "office" | "airport" | "toronto-street" | "warehouse" | "boardroom"
  | "living-room" | "agent-office" | "church";

export interface SetLayers { far: ReactNode; mid: ReactNode; near?: ReactNode }

const W = 1600;

function Window({ x, y, w, h, sky, snow }: { x: number; y: number; w: number; h: number; sky: string; snow?: boolean }) {
  return (
    <g>
      <rect x={x - 10} y={y - 10} width={w + 20} height={h + 20} rx="6" fill="#3f3328" />
      <rect x={x} y={y} width={w} height={h} fill={sky} />
      {snow ? <g fill="#fff" opacity="0.85">{Array.from({ length: 14 }, (_, i) => <circle key={i} className="snowflake"
        cx={x + ((i * 53) % w)} cy={y + ((i * 37) % h)} r={3 + (i % 3)} style={{ animationDelay: `${(i % 5) * 0.4}s` }} />)}</g> : null}
      <rect x={x + w / 2 - 4} y={y} width="8" height={h} fill="#3f3328" />
      <rect x={x} y={y + h / 2 - 4} width={w} height="8" fill="#3f3328" />
    </g>
  );
}

function Lamp({ x }: { x: number }) {
  return (
    <g>
      <rect x={x - 3} y="0" width="6" height="90" fill="#1f2937" />
      <path d={`M${x - 40} 150 L${x - 20} 90 L${x + 20} 90 L${x + 40} 150 Z`} fill="#fde68a" />
      <rect x={x - 40} y="146" width="80" height="8" fill="#b45309" />
    </g>
  );
}

const SETS: Record<SetKind, () => SetLayers> = {
  "lagos-street": () => ({
    far: (
      <g>
        <rect width={W} height="900" fill="#f4b183" />
        <circle cx="1280" cy="170" r="70" fill="#fde68a" />
        {[[0, 330, 180], [170, 260, 150], [330, 300, 200], [540, 220, 170], [720, 290, 160], [890, 250, 210], [1110, 310, 150], [1270, 240, 190], [1460, 300, 160]].map(([x, y, w]) => (
          <g key={x}><rect x={x} y={y} width={w} height={600} fill="#9a6b52" />
            {Array.from({ length: 4 }, (_, i) => <rect key={i} x={x + 20 + (i % 2) * (w / 2)} y={y + 30 + Math.floor(i / 2) * 70} width={w / 3} height="34" fill="#6b4535" />)}</g>
        ))}
      </g>
    ),
    mid: (
      <g>
        {/* shops and signs */}
        {[[40, "#d97706", "ADEKUNLE PHONES"], [420, "#15803d", "MAMA T FOOD"], [800, "#1d4ed8", "PRINTING & CAC"], [1180, "#b91c1c", "PURE WATER"]].map(([x, c, label]) => (
          <g key={x as number}>
            <rect x={x as number} y="430" width="340" height="330" fill="#e7d3b0" />
            <rect x={(x as number) + 10} y="440" width="320" height="64" fill={c as string} />
            <text x={(x as number) + 170} y="482" textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff" fontFamily="sans-serif">{label as string}</text>
            <rect x={(x as number) + 30} y="540" width="120" height="220" fill="#4b3a2a" />
            <rect x={(x as number) + 180} y="540" width="130" height="110" fill="#7dd3fc" opacity="0.6" />
          </g>
        ))}
        {/* power lines */}
        <path d="M0 300 Q400 360 800 300 T1600 300" stroke="#1f2937" strokeWidth="4" fill="none" />
        <path d="M0 330 Q400 390 800 330 T1600 330" stroke="#1f2937" strokeWidth="3" fill="none" />
      </g>
    ),
    near: (
      <g>
        <rect y="760" width={W} height="140" fill="#3a3a3f" />
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={i * 190 + 20} y="826" width="110" height="10" fill="#facc15" />)}
        {/* a danfo parked at the edge */}
        <g transform="translate(1250 700)">
          <rect x="0" y="0" width="330" height="120" rx="20" fill="#facc15" />
          <rect x="0" y="60" width="330" height="14" fill="#111" />
          {[20, 100, 180].map((x) => <rect key={x} x={x} y="14" width="64" height="40" fill="#1f2937" />)}
          <circle cx="70" cy="122" r="28" fill="#111" /><circle cx="270" cy="122" r="28" fill="#111" />
        </g>
      </g>
    ),
  }),
  bedroom: () => ({
    far: (
      <g>
        <rect width={W} height="900" fill="#3b4a6b" />
        <Window x={980} y={170} w={300} h={240} sky="#111a33" />
        <circle cx="1200" cy="230" r="34" fill="#fef3c7" />
        <rect x="120" y="180" width="220" height="150" fill="#e2e8f0" opacity="0.15" />
        <text x="230" y="270" textAnchor="middle" fontSize="34" fill="#e2e8f0" opacity="0.5" fontFamily="sans-serif" fontWeight="800">CANADA</text>
      </g>
    ),
    mid: (
      <g>
        <rect x="0" y="560" width="620" height="200" rx="20" fill="#7c2d12" />
        <rect x="20" y="520" width="560" height="80" rx="30" fill="#f1f5f9" />
        <rect x="40" y="500" width="160" height="60" rx="24" fill="#fff" />
        <rect x="700" y="610" width="260" height="150" fill="#57391f" />
        <rect x="730" y="560" width="190" height="50" fill="#1e293b" />
        <rect x="738" y="566" width="174" height="38" fill="#38bdf8" opacity="0.5" />
        {/* ceiling fan */}
        <g transform="translate(800 60)"><rect x="-3" y="0" width="6" height="60" fill="#111" />
          <g className="fan-spin"><rect x="-140" y="56" width="280" height="12" rx="6" fill="#94a3b8" /></g></g>
      </g>
    ),
    near: <rect y="760" width={W} height="140" fill="#6b4f3a" />,
  }),
  cafe: () => ({
    far: (
      <g>
        <rect width={W} height="900" fill="#1f3a3d" />
        <rect x="80" y="120" width="560" height="90" fill="#0f766e" />
        <text x="360" y="180" textAnchor="middle" fontSize="44" fontWeight="900" fill="#ccfbf1" fontFamily="sans-serif">BRIGHT STAR CYBER CAFÉ</text>
        <rect x="900" y="120" width="420" height="200" fill="#fff" opacity="0.08" />
        <text x="1110" y="200" textAnchor="middle" fontSize="28" fill="#fde68a" fontFamily="sans-serif">BROWSING ₦300/HR</text>
        <text x="1110" y="250" textAnchor="middle" fontSize="28" fill="#fde68a" fontFamily="sans-serif">PRINTING · SCANNING</text>
      </g>
    ),
    mid: (
      <g>
        {[100, 520, 940, 1360].map((x) => (
          <g key={x}><rect x={x} y="560" width="300" height="24" fill="#a16207" /><rect x={x + 20} y="584" width="16" height="176" fill="#713f12" /><rect x={x + 264} y="584" width="16" height="176" fill="#713f12" />
            <rect x={x + 70} y="440" width="160" height="110" rx="6" fill="#111827" /><rect x={x + 80} y="450" width="140" height="88" fill="#60a5fa" opacity="0.7" /><rect x={x + 140} y="550" width="20" height="12" fill="#111" /></g>
        ))}
      </g>
    ),
    near: <rect y="760" width={W} height="140" fill="#4b5563" />,
  }),
  office: () => ({
    far: (
      <g>
        <rect width={W} height="900" fill="#d6dde6" />
        <rect y="0" width={W} height="90" fill="#9fb0c4" />
        {/* a generic flag and a clock: no real seals or logos */}
        <rect x="200" y="160" width="10" height="320" fill="#475569" />
        <rect x="210" y="170" width="190" height="110" fill="#fff" /><rect x="210" y="170" width="48" height="110" fill="#dc2626" /><rect x="352" y="170" width="48" height="110" fill="#dc2626" />
        <circle cx="1350" cy="220" r="60" fill="#fff" stroke="#334155" strokeWidth="8" />
        <path d="M1350 220 L1350 180 M1350 220 L1380 236" stroke="#334155" strokeWidth="7" strokeLinecap="round" />
        <rect x="560" y="140" width="560" height="70" fill="#1e3a8a" />
        <text x="840" y="188" textAnchor="middle" fontSize="34" fontWeight="800" fill="#fff" fontFamily="sans-serif">PLEASE HAVE YOUR DOCUMENTS READY</text>
      </g>
    ),
    mid: (
      <g>
        {/* counter with glass */}
        <rect x="0" y="560" width={W} height="200" fill="#64748b" />
        <rect x="0" y="540" width={W} height="26" fill="#334155" />
        <rect x="0" y="260" width={W} height="280" fill="#bae6fd" opacity="0.18" />
        {[400, 800, 1200].map((x) => <rect key={x} x={x - 4} y="260" width="8" height="300" fill="#94a3b8" />)}
        {/* stacks of files */}
        {[120, 160, 1420, 1460].map((x, i) => <rect key={x} x={x} y={500 - (i % 2) * 20} width="70" height={40 + (i % 2) * 20} fill={i % 2 ? "#f59e0b" : "#fef3c7"} />)}
        <rect x="620" y="470" width="150" height="70" rx="6" fill="#1f2937" /><rect x="630" y="478" width="130" height="54" fill="#93c5fd" opacity="0.6" />
      </g>
    ),
    near: <rect y="760" width={W} height="140" fill="#94a3b8" />,
  }),
  airport: () => ({
    far: (
      <g>
        <rect width={W} height="900" fill="#cbd5e1" />
        <rect x="0" y="120" width={W} height="300" fill="#7dd3fc" />
        {[0, 320, 640, 960, 1280].map((x) => <rect key={x} x={x} y="120" width="10" height="300" fill="#475569" />)}
        <g className="plane-pass" transform="translate(200 230)"><rect x="0" y="0" width="260" height="34" rx="17" fill="#fff" /><path d="M100 10 L170 -50 L190 -50 L150 10 Z M100 30 L170 80 L190 80 L150 30 Z" fill="#e2e8f0" /><path d="M0 4 L-30 -40 L-10 -40 L30 6 Z" fill="#dc2626" /></g>
        <rect x="560" y="440" width="520" height="70" fill="#111827" />
        <text x="820" y="488" textAnchor="middle" fontSize="34" fontWeight="800" fill="#fbbf24" fontFamily="monospace">DEPARTURES · ARRIVALS</text>
      </g>
    ),
    mid: (
      <g>
        {[100, 500, 900, 1300].map((x) => <g key={x}><rect x={x} y="640" width="10" height="120" fill="#475569" /><rect x={x + 10} y="660" width="390" height="8" fill="#1d4ed8" /></g>)}
        {[300, 420, 1100].map((x) => <g key={x}><rect x={x} y="680" width="80" height="80" rx="10" fill={x === 420 ? "#7c3aed" : "#0f766e"} /><rect x={x + 30} y="660" width="20" height="24" fill="#111" /></g>)}
      </g>
    ),
    near: <rect y="760" width={W} height="140" fill="#e2e8f0" />,
  }),
  "toronto-street": () => ({
    far: (
      <g>
        <rect width={W} height="900" fill="#b9c6d6" />
        <rect x="1060" y="40" width="22" height="560" fill="#64748b" /><ellipse cx="1071" cy="230" rx="44" ry="26" fill="#64748b" />
        {[[0, 260, 200], [220, 200, 160], [400, 300, 220], [660, 180, 170], [860, 280, 160], [1120, 240, 200], [1340, 200, 260]].map(([x, y, w]) => (
          <g key={x}><rect x={x} y={y} width={w} height={600} fill="#7b8ba3" />
            {Array.from({ length: 6 }, (_, i) => <rect key={i} x={x + 18 + (i % 3) * (w / 3.3)} y={y + 30 + Math.floor(i / 3) * 80} width={w / 5} height="40" fill="#cbd5e1" opacity="0.7" />)}</g>
        ))}
      </g>
    ),
    mid: (
      <g>
        <rect x="0" y="520" width={W} height="240" fill="#a8b4c4" />
        {[120, 560, 1000].map((x) => <g key={x}><rect x={x} y="540" width="300" height="220" fill="#8b5e3c" /><rect x={x + 30} y="580" width="240" height="120" fill="#e0f2fe" opacity="0.7" /></g>)}
        <g transform="translate(1260 560)"><rect x="0" y="0" width="300" height="150" rx="14" fill="#dc2626" /><rect x="0" y="70" width="300" height="14" fill="#fff" />
          {[20, 110, 200].map((x) => <rect key={x} x={x} y="16" width="70" height="46" fill="#1f2937" />)}</g>
      </g>
    ),
    near: (
      <g>
        <rect y="760" width={W} height="140" fill="#f1f5f9" />
        <rect y="760" width={W} height="20" fill="#cbd5e1" />
        <g fill="#fff">{Array.from({ length: 40 }, (_, i) => <circle key={i} className="snowflake" cx={(i * 97) % W} cy={(i * 61) % 700} r={3 + (i % 4)}
          style={{ animationDelay: `${(i % 7) * 0.5}s` }} />)}</g>
      </g>
    ),
  }),
  warehouse: () => ({
    far: (
      <g>
        <rect width={W} height="900" fill="#4b5563" />
        {[0, 200, 400, 600, 800, 1000, 1200, 1400].map((x) => <rect key={x} x={x} y="0" width="8" height="760" fill="#374151" />)}
        <rect x="1080" y="140" width="380" height="220" fill="#111827" /><rect x="1096" y="156" width="348" height="188" fill="#fde68a" opacity="0.35" />
        <text x="1270" y="120" textAnchor="middle" fontSize="28" fontWeight="800" fill="#facc15" fontFamily="sans-serif">SUPERVISOR</text>
        <rect x="120" y="120" width="520" height="70" fill="#facc15" />
        <text x="380" y="168" textAnchor="middle" fontSize="34" fontWeight="900" fill="#111" fontFamily="sans-serif">SAFETY FIRST · 0 DAYS LOST</text>
      </g>
    ),
    mid: (
      <g>
        {[60, 560].map((x) => (
          <g key={x}>
            {[300, 440, 580].map((y) => <rect key={y} x={x} y={y} width="420" height="14" fill="#f97316" />)}
            <rect x={x} y="280" width="14" height="480" fill="#f97316" /><rect x={x + 406} y="280" width="14" height="480" fill="#f97316" />
            {[310, 450, 590].flatMap((y) => [x + 30, x + 150, x + 270].map((bx) => <rect key={`${bx}${y}`} x={bx} y={y - 96} width="100" height="96" fill="#c08a5a" stroke="#8b5e34" strokeWidth="4" />))}
          </g>
        ))}
      </g>
    ),
    near: (
      <g>
        <rect y="760" width={W} height="140" fill="#9ca3af" />
        <rect y="800" width={W} height="10" fill="#facc15" />
        <g transform="translate(1250 600)"><rect x="0" y="40" width="200" height="120" rx="10" fill="#f59e0b" /><rect x="150" y="-60" width="16" height="220" fill="#111" /><rect x="166" y="120" width="110" height="12" fill="#111" />
          <circle cx="40" cy="168" r="30" fill="#111" /><circle cx="160" cy="168" r="30" fill="#111" /></g>
      </g>
    ),
  }),
  boardroom: () => ({
    far: (
      <g>
        <rect width={W} height="900" fill="#1e293b" />
        <rect x="80" y="100" width="1440" height="460" fill="#93c5fd" opacity="0.25" />
        {[[120, 300], [300, 220], [520, 330], [720, 180], [960, 280], [1180, 230], [1380, 320]].map(([x, y]) => <rect key={x} x={x} y={y} width="150" height={560 - y} fill="#334155" />)}
        {[80, 560, 1040, 1520].map((x) => <rect key={x} x={x - 6} y="100" width="12" height="460" fill="#0f172a" />)}
      </g>
    ),
    mid: (
      <g>
        <rect x="200" y="600" width="1200" height="40" rx="10" fill="#78350f" />
        <rect x="240" y="640" width="30" height="120" fill="#451a03" /><rect x="1330" y="640" width="30" height="120" fill="#451a03" />
        <rect x="560" y="560" width="160" height="40" fill="#e2e8f0" /><rect x="900" y="570" width="90" height="30" fill="#0ea5e9" />
      </g>
    ),
    near: <rect y="760" width={W} height="140" fill="#334155" />,
  }),
  "living-room": () => ({
    far: (
      <g>
        <rect width={W} height="900" fill="#e8d5b5" />
        <Window x={1080} y={150} w={340} h={280} sky="#cbd5e1" snow />
        {[[200, 180, "#b45309"], [380, 220, "#0f766e"], [540, 170, "#7c3aed"]].map(([x, y, c]) => <g key={x as number}>
          <rect x={x as number} y={y as number} width="120" height="150" fill="#3f2a14" /><rect x={(x as number) + 12} y={(y as number) + 12} width="96" height="126" fill={c as string} opacity="0.6" /></g>)}
        <Lamp x={880} />
      </g>
    ),
    mid: (
      <g>
        <rect x="120" y="560" width="760" height="200" rx="30" fill="#0f766e" />
        <rect x="140" y="480" width="720" height="120" rx="40" fill="#14b8a6" />
        <rect x="100" y="540" width="80" height="220" rx="30" fill="#0f766e" /><rect x="820" y="540" width="80" height="220" rx="30" fill="#0f766e" />
        <rect x="1000" y="620" width="300" height="20" fill="#78350f" /><rect x="1020" y="640" width="16" height="120" fill="#451a03" /><rect x="1264" y="640" width="16" height="120" fill="#451a03" />
        <rect x="1100" y="580" width="60" height="40" rx="8" fill="#fff" />
      </g>
    ),
    near: <rect y="760" width={W} height="140" fill="#a16207" />,
  }),
  "agent-office": () => ({
    far: (
      <g>
        <rect width={W} height="900" fill="#e9e2c9" />
        <rect x="120" y="120" width="460" height="300" fill="#dc2626" />
        <text x="350" y="210" textAnchor="middle" fontSize="44" fontWeight="900" fill="#fff" fontFamily="sans-serif">CANADA</text>
        <text x="350" y="270" textAnchor="middle" fontSize="34" fontWeight="900" fill="#fde68a" fontFamily="sans-serif">100% GUARANTEE</text>
        <text x="350" y="330" textAnchor="middle" fontSize="26" fill="#fff" fontFamily="sans-serif">VISA IN 2 WEEKS!!!</text>
        <text x="350" y="390" textAnchor="middle" fontSize="20" fill="#fff" opacity="0.8" fontFamily="sans-serif">Glory Gate Travels (fictional)</text>
        <rect x="900" y="150" width="300" height="200" fill="#1d4ed8" />
        <text x="1050" y="240" textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff" fontFamily="sans-serif">WORK PERMIT</text>
        <text x="1050" y="290" textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff" fontFamily="sans-serif">NO IELTS</text>
      </g>
    ),
    mid: (
      <g>
        <rect x="300" y="580" width="1000" height="40" fill="#57391f" />
        <rect x="320" y="620" width="30" height="140" fill="#3f2a14" /><rect x="1250" y="620" width="30" height="140" fill="#3f2a14" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={700 + i * 16} y={548 - i * 8} width="120" height="32" fill="#16a34a" stroke="#14532d" strokeWidth="3" />)}
        <g transform="translate(1400 120)"><rect x="-3" y="0" width="6" height="160" fill="#111" /><g className="fan-spin"><rect x="-90" y="150" width="180" height="16" rx="8" fill="#94a3b8" /></g></g>
      </g>
    ),
    near: <rect y="760" width={W} height="140" fill="#8b6b4a" />,
  }),
  church: () => ({
    far: (
      <g>
        <rect width={W} height="900" fill="#f5efe0" />
        <rect x="440" y="80" width="720" height="110" fill="#7c3aed" />
        <text x="800" y="150" textAnchor="middle" fontSize="44" fontWeight="900" fill="#fff" fontFamily="sans-serif">BREAKTHROUGH NIGHT</text>
        <rect x="780" y="220" width="40" height="260" fill="#a16207" /><rect x="700" y="290" width="200" height="40" fill="#a16207" />
        {[120, 1340].map((x) => <g key={x}><rect x={x} y="200" width="140" height="300" rx="70" fill="#93c5fd" /><rect x={x + 66} y="200" width="8" height="300" fill="#f5efe0" /></g>)}
      </g>
    ),
    mid: (
      <g>
        <rect x="620" y="520" width="360" height="240" fill="#78350f" /><rect x="600" y="500" width="400" height="30" fill="#92400e" />
        {[0, 1].map((r) => <rect key={r} x="0" y={640 + r * 60} width="520" height="40" fill="#8b5e34" />)}
        {[0, 1].map((r) => <rect key={`b${r}`} x="1080" y={640 + r * 60} width="520" height="40" fill="#8b5e34" />)}
      </g>
    ),
    near: <rect y="760" width={W} height="140" fill="#b91c1c" opacity="0.85" />,
  }),
};

export function setLayers(kind: SetKind): SetLayers {
  return SETS[kind]();
}
