export type PersonPose = "idle" | "walk" | "phone" | "sit" | "wave" | "queue";
export type PersonWho =
  | "you"
  | "ada"
  | "roommate"
  | "npc"
  | "agent"
  | "clerk"
  | "preacher";

const LOOK: Record<
  PersonWho,
  { skin: string; shirt: string; pants: string; hair: string }
> = {
  you: {
    skin: "#8d4a24",
    shirt: "#16a34a",
    pants: "#1e293b",
    hair: "#1a120c",
  },
  ada: {
    skin: "#6d3416",
    shirt: "#9f1239",
    pants: "#334155",
    hair: "#111827",
  },
  roommate: {
    skin: "#a16207",
    shirt: "#2563eb",
    pants: "#0f172a",
    hair: "#292524",
  },
  npc: {
    skin: "#7c3a12",
    shirt: "#f59e0b",
    pants: "#365314",
    hair: "#1c1917",
  },
  agent: {
    skin: "#92400e",
    shirt: "#e2e8f0",
    pants: "#1e3a8a",
    hair: "#0f172a",
  },
  clerk: {
    skin: "#78350f",
    shirt: "#38bdf8",
    pants: "#111827",
    hair: "#1e1b4b",
  },
  preacher: {
    skin: "#5b3410",
    shirt: "#f8fafc",
    pants: "#000000",
    hair: "#0b0b0b",
  },
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
}: {
  who: PersonWho;
  pose?: PersonPose;
  x?: number;
  flip?: boolean;
  delay?: string;
  scale?: number;
  shirt?: string;
  caption?: string;
}) {
  const look = LOOK[who];
  const poseClass =
    pose === "walk"
      ? "person-walk"
      : pose === "phone"
        ? "person-phone"
        : pose === "sit"
          ? "person-sit"
          : pose === "wave"
            ? "person-wave"
            : pose === "queue"
              ? "person-queue"
              : "person-idle";

  return (
    <div
      className={`person-wrap ${poseClass}`}
      style={{
        left: `${x}%`,
        animationDelay: delay,
        transform: `translateX(-50%) scale(${flip ? -scale : scale}, ${scale})`,
      }}
    >
      {caption ? <span className="person-name">{caption}</span> : null}
      <div className="person">
        <span className="p-hair" style={{ background: look.hair }} />
        <span className="p-head" style={{ background: look.skin }}>
          <i className="p-eye e1" />
          <i className="p-eye e2" />
        </span>
        <span
          className="p-torso"
          style={{ background: shirt ?? look.shirt }}
        />
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
