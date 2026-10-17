// A film character drawn in SVG, so it stays sharp from a wide shot down to a close-up on the face.
// Standing with the feet at (0, 0) and the top of the head near y = -470; the camera does the framing.
import type { ReactNode } from "react";
import type { Avatar } from "@/game/profile";

export type ActorPose = "idle" | "talk" | "walk" | "cheer" | "slump" | "phone" | "listen" | "point" | "sit" | "hold" | "raise" | "reach";
/**
 * Something the actor is doing, on top of the pose: reading (eyes running along the lines), typing, tapping a phone,
 * counting notes, writing, opening an envelope, lifting a box, glancing over their shoulder, or a reaction:
 * a fist pump, hands on the head, a shrug, a nod, wiping the forehead, a yawn, a wave.
 */
export type ActorAction =
  | "read" | "type" | "tap" | "count" | "write" | "open" | "lift" | "glance" | "jingle"
  | "fistpump" | "headhands" | "shrug" | "nod" | "wipe" | "yawn" | "wave" | "selfie";

/** Reactions that move the arms away from the pose. */
const ACTION_ARMS: Partial<Record<ActorAction, [number, number]>> = {
  fistpump: [10, -150], headhands: [158, -158], shrug: [50, -50], wipe: [8, -165], yawn: [150, -150], wave: [8, -150], selfie: [-30, -150],
};

export type ActorFace = "neutral" | "smile" | "grin" | "worried" | "sad" | "shock" | "angry" | "reading" | "sleep";

export interface Look {
  skin: string;
  hair: Avatar["hair"];
  hairColor: string;
  outfit: Avatar["outfit"] | "uniform" | "vest" | "cassock";
  outfitColor: string;
  pants?: string;
  headwear?: Avatar["headwear"];
  headwearColor?: string;
  glasses?: boolean;
  tie?: string;
  body?: Avatar["body"];
  beard?: boolean;
}

const INK = "#1b1210";

function Hair({ look }: { look: Look }) {
  const c = look.hairColor;
  switch (look.hair) {
    case "afro":
      return <ellipse cx="0" cy="-428" rx="82" ry="74" fill={c} />;
    case "braids":
      return (
        <g fill={c}>
          <path d="M-60 -420 Q-62 -488 0 -490 Q62 -488 60 -420 L60 -330 L44 -330 L44 -420 L-44 -420 L-44 -330 L-60 -330 Z" />
          {[-52, -40, 40, 52].map((x) => <rect key={x} x={x - 4} y="-420" width="8" height="96" rx="4" />)}
        </g>
      );
    case "bun":
      return (
        <g fill={c}>
          <circle cx="0" cy="-492" r="24" />
          <path d="M-58 -404 Q-60 -476 0 -478 Q60 -476 58 -404 Q40 -446 0 -448 Q-40 -446 -58 -404 Z" />
        </g>
      );
    case "bald":
      return null;
    default: // low-cut
      return <path d="M-57 -410 Q-58 -474 0 -476 Q58 -474 57 -410 Q44 -450 0 -452 Q-44 -450 -57 -410 Z" fill={c} />;
  }
}

function Headwear({ look }: { look: Look }) {
  const c = look.headwearColor ?? "#b45309";
  switch (look.headwear) {
    case "gele":
      return (
        <g fill={c}>
          <path d="M-74 -432 Q-90 -520 -10 -528 Q70 -540 92 -470 Q96 -440 64 -430 Q0 -470 -74 -432 Z" />
          <path d="M40 -520 Q96 -560 110 -500 Q90 -490 60 -496 Z" opacity="0.85" />
        </g>
      );
    case "fila":
      return <path d="M-56 -444 L-46 -500 Q4 -522 54 -496 L58 -446 Q0 -462 -56 -444 Z" fill={c} transform="rotate(-6 0 -470)" />;
    case "headwrap":
      return <path d="M-62 -418 Q-70 -500 0 -506 Q70 -500 62 -418 Q36 -450 0 -452 Q-36 -450 -62 -418 Z" fill={c} />;
    case "beanie":
      return (
        <g fill={c}>
          <path d="M-60 -432 Q-62 -500 0 -504 Q62 -500 60 -432 Z" />
          <rect x="-62" y="-444" width="124" height="18" rx="9" fill="#fff" opacity="0.35" />
        </g>
      );
    default:
      return null;
  }
}

function Eyes({ face, ink }: { face: ActorFace; ink: string }) {
  if (face === "sleep") {
    return (
      <g stroke={ink} strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M-32 -410 Q-21 -400 -10 -410" />
        <path d="M10 -410 Q21 -400 32 -410" />
      </g>
    );
  }
  if (face === "grin") {
    return (
      <g stroke={ink} strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M-32 -412 Q-21 -426 -10 -412" />
        <path d="M10 -412 Q21 -426 32 -412" />
      </g>
    );
  }
  const r = face === "shock" ? 13 : 11;
  return (
    <g className="actor-eyes">
      {[-21, 21].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="-412" rx={r} ry={r + 2} fill="#fff" />
          <g className="pupils">
            <circle cx={x + 1} cy={face === "reading" ? -404 : face === "sad" ? -408 : -411} r={face === "shock" ? 5 : 6.5} fill={ink} />
            <circle cx={x + 4} cy={face === "reading" ? -407 : -415} r="2" fill="#fff" />
          </g>
        </g>
      ))}
    </g>
  );
}

function Brows({ face, color }: { face: ActorFace; color: string }) {
  const d: Record<ActorFace, [string, string]> = {
    neutral: ["M-34 -434 Q-21 -440 -8 -434", "M8 -434 Q21 -440 34 -434"],
    smile: ["M-34 -436 Q-21 -444 -8 -436", "M8 -436 Q21 -444 34 -436"],
    grin: ["M-34 -438 Q-21 -446 -8 -438", "M8 -438 Q21 -446 34 -438"],
    worried: ["M-34 -432 Q-21 -436 -8 -442", "M8 -442 Q21 -436 34 -432"],
    sad: ["M-34 -430 Q-21 -434 -8 -442", "M8 -442 Q21 -434 34 -430"],
    shock: ["M-34 -446 Q-21 -454 -8 -446", "M8 -446 Q21 -454 34 -446"],
    angry: ["M-34 -442 Q-21 -436 -8 -432", "M8 -432 Q21 -436 34 -442"],
    reading: ["M-34 -432 Q-21 -436 -8 -432", "M8 -432 Q21 -436 34 -432"],
    sleep: ["M-34 -430 Q-21 -432 -8 -430", "M8 -430 Q21 -432 34 -430"],
  };
  return (
    <g stroke={color} strokeWidth="6" fill="none" strokeLinecap="round">
      <path d={d[face][0]} />
      <path d={d[face][1]} />
    </g>
  );
}

function Mouth({ face, talking }: { face: ActorFace; talking: boolean }) {
  const lips = "#5a1f17";
  if (talking) {
    return (
      <g>
        <ellipse className="mouth-open" cx="0" cy="-374" rx="13" ry="10" fill={lips} />
        <path className="mouth-closed" d="M-14 -376 Q0 -368 14 -376" stroke={lips} strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  switch (face) {
    case "grin":
      return (
        <g>
          <path d="M-24 -384 Q0 -350 24 -384 Z" fill={lips} />
          <path d="M-20 -383 L20 -383 L18 -377 L-18 -377 Z" fill="#fff" />
        </g>
      );
    case "smile":
      return <path d="M-18 -380 Q0 -366 18 -380" stroke={lips} strokeWidth="5" fill="none" strokeLinecap="round" />;
    case "worried":
      return <path d="M-14 -370 Q0 -378 14 -370" stroke={lips} strokeWidth="5" fill="none" strokeLinecap="round" />;
    case "sad":
      return <path d="M-18 -366 Q0 -380 18 -366" stroke={lips} strokeWidth="5" fill="none" strokeLinecap="round" />;
    case "shock":
      return <ellipse cx="0" cy="-372" rx="10" ry="14" fill={lips} />;
    case "angry":
      return <path d="M-16 -372 L16 -372" stroke={lips} strokeWidth="6" strokeLinecap="round" />;
    default:
      return <path d="M-12 -376 L12 -376" stroke={lips} strokeWidth="5" strokeLinecap="round" />;
  }
}

/** Arm angles (degrees, 0 = hanging down) for the left and right arm. */
const ARMS: Record<ActorPose, [number, number]> = {
  idle: [8, -8], talk: [10, -60], walk: [18, -18], cheer: [160, -160], slump: [3, -3], phone: [8, -150],
  listen: [10, -10], point: [8, -95], sit: [30, -30], hold: [-28, 28], raise: [8, -165], reach: [8, -80],
};

/** Where the prop sits for the poses that carry one: both hands in front, held up high, or held out. */
const PROP_AT: Partial<Record<ActorPose, [number, number]>> = { hold: [0, -212], raise: [100, -470], reach: [204, -293] };

function Arm({ side, angle, sleeve, skin, className }: { side: -1 | 1; angle: number; sleeve: string; skin: string; className?: string }) {
  return (
    <g transform={`translate(${side * 64} -318) rotate(${angle})`}>
      {/* The inner group swings (walk, talk) around the shoulder, on top of the pose's angle. */}
      <g className={className}>
        <rect x="-15" y="-6" width="30" height="96" rx="15" fill={sleeve} />
        <rect x="-13" y="70" width="26" height="70" rx="13" fill={skin} />
        <circle cx="0" cy="142" r="17" fill={skin} />
      </g>
    </g>
  );
}

export function Actor({ look, pose = "idle", face = "neutral", talking = false, x = 0, y = 0, scale = 1, flip = false, className = "", prop, action }: {
  look: Look; pose?: ActorPose; face?: ActorFace; talking?: boolean; x?: number; y?: number; scale?: number; flip?: boolean; className?: string;
  /** Something in their hands (with the hold, raise or reach pose). */
  prop?: ReactNode;
  /** What they're doing on top of the pose (see ActorAction). */
  action?: ActorAction;
}) {
  const propAt = action && ACTION_ARMS[action] ? undefined : PROP_AT[pose];
  const wide = look.body === "plus" ? 1.22 : look.body === "slim" ? 0.88 : 1;
  const top = look.outfitColor;
  const pants = look.pants ?? (look.outfit === "tee-jeans" ? "#28427a" : look.outfit === "hoodie" ? "#1f2937" : "#2b2f3a");
  const robe = look.outfit === "agbada" || look.outfit === "senator" || look.outfit === "cassock";
  const dress = look.outfit === "ankara-dress" || look.outfit === "buba-iro";
  const sleeve = top;
  const [la, ra] = (action && ACTION_ARMS[action]) ?? ARMS[pose];
  const brow = look.hair === "bald" ? INK : look.hairColor;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} className={`actor pose-${pose} ${action ? `act-${action}` : ""} ${className}`}>
      <g className="actor-body">
        {/* shadow */}
        <ellipse cx="0" cy="4" rx={78 * wide} ry="12" fill="#000" opacity="0.25" />
        {/* legs */}
        <g className="actor-legs">
          <g className="leg-l"><rect x="-40" y="-178" width="34" height="172" rx="14" fill={dress ? look.skin : pants} />
            <ellipse cx="-26" cy="-6" rx="28" ry="12" fill={INK} /></g>
          <g className="leg-r"><rect x="6" y="-178" width="34" height="172" rx="14" fill={dress ? look.skin : pants} />
            <ellipse cx="26" cy="-6" rx="28" ry="12" fill={INK} /></g>
        </g>
        {dress ? <path d={`M${-70 * wide} -190 L${70 * wide} -190 L${84 * wide} -60 L${-84 * wide} -60 Z`} fill={top} className="pattern" /> : null}
        {robe ? <path d={`M${-78 * wide} -330 L${78 * wide} -330 L${92 * wide} -70 L${-92 * wide} -70 Z`} fill={top} /> : null}
        {/* torso */}
        <g className="actor-torso">
          <rect x={-62 * wide} y="-340" width={124 * wide} height="176" rx="30" fill={top} />
          {look.outfit === "suit" ? (
            <g>
              <path d="M-22 -340 L0 -280 L22 -340 Z" fill="#f8fafc" />
              <rect x="-6" y="-330" width="12" height="70" fill={look.tie ?? "#7f1d1d"} />
            </g>
          ) : null}
          {look.tie && look.outfit !== "suit" ? <rect x="-6" y="-336" width="12" height="70" fill={look.tie} /> : null}
          {look.outfit === "uniform" ? (
            <g>
              <rect x="-62" y="-300" width="124" height="10" fill="#0f172a" opacity="0.35" />
              <rect x="22" y="-318" width="22" height="14" rx="3" fill="#facc15" />
            </g>
          ) : null}
          {look.outfit === "vest" ? (
            <g fill="#facc15">
              <rect x={-62 * wide} y="-330" width="32" height="160" />
              <rect x={62 * wide - 32} y="-330" width="32" height="160" />
              <rect x={-62 * wide} y="-250" width={124 * wide} height="14" fill="#e5e7eb" />
            </g>
          ) : null}
          {look.outfit === "cassock" ? <rect x="-12" y="-342" width="24" height="14" fill="#fff" /> : null}
          {look.outfit === "hoodie" ? <path d="M-50 -340 Q0 -300 50 -340" stroke="#000" strokeOpacity="0.25" strokeWidth="8" fill="none" /> : null}
          {dress || look.outfit === "agbada" ? <g className="pattern-dots" fill="#fff" opacity="0.28">
            {[-30, 0, 30].flatMap((px) => [-300, -250, -200].map((py) => <circle key={`${px}${py}`} cx={px} cy={py} r="7" />))}</g> : null}
        </g>
        {/* arms */}
        <Arm side={-1} angle={la} sleeve={sleeve} skin={look.skin} className="arm-l" />
        <Arm side={1} angle={ra} sleeve={sleeve} skin={look.skin} className="arm-r" />
        {pose === "phone" ? <rect x="44" y="-470" width="26" height="46" rx="6" fill="#111827" stroke="#94a3b8" strokeWidth="3" /> : null}
        {prop && propAt ? (
          <g transform={`translate(${propAt[0]} ${propAt[1]})`}>
            {prop}
            {pose === "hold" ? <g fill={look.skin}><circle cx="-50" cy="12" r="17" /><circle cx="50" cy="12" r="17" /></g> : null}
          </g>
        ) : null}
        {/* head */}
        <g className="actor-head">
          <rect x="-16" y="-356" width="32" height="26" fill={look.skin} />
          {look.outfit === "hoodie" ? <path d="M-74 -330 Q-80 -470 0 -478 Q80 -470 74 -330 Z" fill={top} opacity="0.9" /> : null}
          {look.hair === "afro" ? <Hair look={look} /> : null}
          <circle cx="-58" cy="-404" r="13" fill={look.skin} />
          <circle cx="58" cy="-404" r="13" fill={look.skin} />
          <ellipse cx="0" cy="-404" rx="58" ry="64" fill={look.skin} />
          {look.hair !== "afro" ? <Hair look={look} /> : null}
          <Headwear look={look} />
          <Brows face={face} color={brow} />
          <g className="actor-blink"><Eyes face={face} ink={INK} /></g>
          <path d="M-6 -398 Q0 -386 8 -392" stroke="#000" strokeOpacity="0.25" strokeWidth="5" fill="none" strokeLinecap="round" />
          {look.beard ? <path d="M-44 -384 Q-40 -334 0 -330 Q40 -334 44 -384 Q22 -356 0 -358 Q-22 -356 -44 -384 Z" fill={look.hairColor} /> : null}
          <Mouth face={face} talking={talking} />
          {face === "sad" || face === "worried" ? null : <g fill="#e11d48" opacity="0.12"><circle cx="-34" cy="-388" r="10" /><circle cx="34" cy="-388" r="10" /></g>}
          {look.glasses ? (
            <g stroke="#111827" strokeWidth="5" fill="none">
              <circle cx="-21" cy="-412" r="17" /><circle cx="21" cy="-412" r="17" /><path d="M-4 -412 L4 -412" />
            </g>
          ) : null}
        </g>
      </g>
    </g>
  );
}

/** The head's position in actor space, for close-ups. */
export const HEAD_Y = -410;
