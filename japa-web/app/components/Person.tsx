export type PersonPose = "idle" | "walk" | "phone" | "sit" | "wave" | "queue" | "talk" | "cheer" | "slump";
export type PersonWho =
  | "you"
  | "ada"
  | "roommate"
  | "npc"
  | "agent"
  | "clerk"
  | "preacher"
  | "vance"
  | "chen"
  | "ross"
  | "kovacs"
  | "officer"
  | "mentor"
  | "prof"
  | "student"
  | "tutor";
export type Accessory = "scarf" | "tie" | "cap" | "headwrap" | "glasses";

const LOOK: Record<PersonWho, { skin: string; shirt: string; pants: string; hair: string; extra?: Accessory[]; tint?: string }> = {
  you: { skin: "#8d4a24", shirt: "#16a34a", pants: "#1e293b", hair: "#1a120c" },
  ada: { skin: "#6d3416", shirt: "#9f1239", pants: "#334155", hair: "#111827" },
  roommate: { skin: "#a16207", shirt: "#2563eb", pants: "#0f172a", hair: "#292524" },
  npc: { skin: "#7c3a12", shirt: "#f59e0b", pants: "#365314", hair: "#1c1917" },
  agent: { skin: "#92400e", shirt: "#e2e8f0", pants: "#1e3a8a", hair: "#0f172a" },
  clerk: { skin: "#78350f", shirt: "#38bdf8", pants: "#111827", hair: "#1e1b4b" },
  preacher: { skin: "#5b3410", shirt: "#f8fafc", pants: "#000000", hair: "#0b0b0b" },
  vance: { skin: "#f1c7a3", shirt: "#1e3a8a", pants: "#1e293b", hair: "#7c2d12", extra: ["glasses"] },
  chen: { skin: "#e8b98a", shirt: "#0f766e", pants: "#1e293b", hair: "#0b0b0b" },
  ross: { skin: "#d9a07a", shirt: "#e2e8f0", pants: "#334155", hair: "#a8a29e", extra: ["tie"], tint: "#b91c1c" },
  kovacs: { skin: "#e5b48f", shirt: "#334155", pants: "#111827", hair: "#57534e", extra: ["tie"], tint: "#a16207" },
  officer: { skin: "#c68863", shirt: "#1e3a8a", pants: "#0f172a", hair: "#1c1917" },
  mentor: { skin: "#6d3416", shirt: "#c2410c", pants: "#1e293b", hair: "#111827", extra: ["headwrap"], tint: "#f59e0b" },
  prof: { skin: "#b07850", shirt: "#57534e", pants: "#1e293b", hair: "#d6d3d1", extra: ["glasses"] },
  student: { skin: "#a0613a", shirt: "#7c3aed", pants: "#1e3a8a", hair: "#111827" },
  tutor: { skin: "#f0c8a4", shirt: "#1d4ed8", pants: "#334155", hair: "#3f2a14", extra: ["scarf"], tint: "#dc2626" },
};

const POSE_CLASS: Record<PersonPose, string> = {
  idle: "person-idle",
  walk: "person-walk",
  phone: "person-phone",
  sit: "person-sit",
  wave: "person-wave",
  queue: "person-queue",
  talk: "person-talk",
  cheer: "person-cheer",
  slump: "person-slump",
};

export function Person({
  who,
  pose = "idle",
  x = 40,
  flip = false,
  delay = "0s",
  scale = 1,
  shirt,
  caption,
  wear = [],
}: {
  who: PersonWho;
  pose?: PersonPose;
  x?: number;
  flip?: boolean;
  delay?: string;
  scale?: number;
  shirt?: string;
  caption?: string;
  /** Extra accessories on top of the character's own (e.g. a scarf in winter). */
  wear?: Accessory[];
}) {
  const look = LOOK[who];
  const extras = new Set<Accessory>([...(look.extra ?? []), ...wear]);
  const tint = look.tint ?? "#dc2626";

  return (
    <div
      className={`person-wrap ${POSE_CLASS[pose]}`}
      style={{
        left: `${x}%`,
        animationDelay: delay,
        transform: `translateX(-50%) scale(${flip ? -scale : scale}, ${scale})`,
      }}
    >
      {caption ? (
        // Un-mirror the name tag when the person is flipped to face left.
        <span className="person-name" style={flip ? { transform: "translateX(-50%) scaleX(-1)" } : undefined}>{caption}</span>
      ) : null}
      <div className="person">
        {extras.has("headwrap") ? (
          <span className="p-headwrap" style={{ background: tint }} />
        ) : (
          <span className="p-hair" style={{ background: look.hair }} />
        )}
        {extras.has("cap") ? <span className="p-cap" /> : null}
        <span className="p-head" style={{ background: look.skin }}>
          <i className="p-eye e1" />
          <i className="p-eye e2" />
          {extras.has("glasses") ? <i className="p-glasses" /> : null}
        </span>
        <span className="p-torso" style={{ background: shirt ?? look.shirt }} />
        {extras.has("scarf") ? <span className="p-scarf" style={{ background: who === "you" ? "#dc2626" : tint }} /> : null}
        {extras.has("tie") ? <span className="p-tie" style={{ background: tint }} /> : null}
        <span className="p-arm p-arm-l" style={{ background: look.skin }} />
        <span className="p-arm p-arm-r" style={{ background: look.skin }}>
          {pose === "phone" ? <b className="p-phone" /> : null}
        </span>
        <span className="p-leg p-leg-l" style={{ background: look.pants }} />
        <span className="p-leg p-leg-r" style={{ background: look.pants }} />
      </div>
    </div>
  );
}
