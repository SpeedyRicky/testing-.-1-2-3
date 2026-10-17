"use client";

import { familyFor, type Avatar } from "@/game/profile";
import type { Relative } from "@/game/family";
import { createContext, useContext } from "react";
import type { Face } from "@/game/face";
import { usePlayer } from "./Player";

/** The player's expression, set once per screen from the run's stats. */
const YouFace = createContext<Face>("smile");
export const YouFaceProvider = YouFace.Provider;

const POSE_FACE: Partial<Record<PersonPose, Face>> = { cheer: "grin", slump: "sad", talk: "talk", phone: "worried" };
/** Friendly faces by default; officials keep a straight face. */
const NPC_FACE: Partial<Record<PersonWho, Face>> = { relative: "smile", mentor: "smile", roommate: "smile", member: "neutral" };

export type PersonPose = "idle" | "walk" | "phone" | "sit" | "wave" | "queue" | "talk" | "cheer" | "slump";
export type PersonWho =
  | "you"
  | "relative"
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
  | "tutor"
  | "member"
  | "counsel";
export type Accessory = "scarf" | "tie" | "cap" | "headwrap" | "glasses";

const LOOK: Record<PersonWho, { skin: string; shirt: string; pants: string; hair: string; extra?: Accessory[]; tint?: string }> = {
  you: { skin: "#8d4a24", shirt: "#16a34a", pants: "#1e293b", hair: "#1a120c" },
  relative: { skin: "#6d3416", shirt: "#9f1239", pants: "#334155", hair: "#111827" },
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
  member: { skin: "#c68863", shirt: "#334155", pants: "#111827", hair: "#57534e", extra: ["glasses"] },
  counsel: { skin: "#5b3410", shirt: "#1e293b", pants: "#111827", hair: "#111827", extra: ["tie"], tint: "#7c3aed" },
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

/** How the relative in Canada looks: a sister, a brother or an aunty, dressed for indoors in winter. */
export function relativeAvatar(r: Relative): Avatar {
  const base = { skin: "#6d3416", hairColor: "#111827", headwearColor: "#0d9488", glasses: false } as const;
  if (r.relation === "brother") {
    return { ...base, skin: "#5b3410", body: "average", hair: "low-cut", outfit: "hoodie", outfitColor: "#0f766e", headwear: "none" };
  }
  if (r.relation === "aunty") {
    return { ...base, body: "plus", hair: "bun", outfit: "buba-iro", outfitColor: "#7c3aed", headwear: "headwrap", headwearColor: "#f59e0b", glasses: true };
  }
  return { ...base, body: "slim", hair: "braids", outfit: "tee-jeans", outfitColor: "#9f1239", headwear: r.heritage === "hausa" ? "headwrap" : "none" };
}

const DRESSED_LEGS = new Set(["ankara-dress", "buba-iro"]);

function pantsFor(a: Avatar): string {
  if (DRESSED_LEGS.has(a.outfit)) return a.skin;
  if (a.outfit === "tee-jeans") return "#1e3a8a";
  if (a.outfit === "hoodie") return "#1f2937";
  return a.outfitColor;
}

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
  avatar,
  face,
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
  /** Explicit look (the sign-up preview); otherwise "you" uses the signed-in player's avatar. */
  avatar?: Avatar;
  /** Expression; otherwise taken from the pose, then (for "you") from the run's stats. */
  face?: Face;
}) {
  const { profile } = usePlayer();
  const youFace = useContext(YouFace);
  const expr: Face = face ?? POSE_FACE[pose] ?? (who === "you" ? youFace : NPC_FACE[who] ?? "neutral");
  const base = LOOK[who];
  const av = who === "you" ? avatar ?? profile?.avatar : who === "relative" ? relativeAvatar(familyFor(profile)) : undefined;
  const extras = new Set<Accessory>([...(base.extra ?? []), ...wear]);
  if (av?.glasses) extras.add("glasses");
  const tint = base.tint ?? "#dc2626";
  const skin = av?.skin ?? base.skin;
  const top = shirt ?? av?.outfitColor ?? base.shirt;
  const pants = av ? pantsFor(av) : base.pants;
  const hairColor = av?.hairColor ?? base.hair;
  const ankaraTop = av && (av.outfit === "ankara-dress" || av.outfit === "buba-iro");
  // The player's name tag shows their username.
  const label = who === "you" && caption && profile ? profile.username : caption;
  const classes = av ? `body-${av.body} hair-${av.hair} outfit-${av.outfit}` : "";
  const headwear = av?.headwear && av.headwear !== "none" ? av.headwear : null;

  return (
    <div
      className={`person-wrap ${POSE_CLASS[pose]} ${classes}`}
      style={{
        left: `${x}%`,
        animationDelay: delay,
        transform: `translateX(-50%) scale(${flip ? -scale : scale}, ${scale})`,
      }}
    >
      {label ? (
        // Un-mirror the name tag when the person is flipped to face left.
        <span className="person-name" style={flip ? { transform: "translateX(-50%) scaleX(-1)" } : undefined}>{label}</span>
      ) : null}
      <div className="person">
        {av?.outfit === "hoodie" ? <span className="p-hood" style={{ background: top }} /> : null}
        {extras.has("headwrap") && !av ? (
          <span className="p-headwrap" style={{ background: tint }} />
        ) : (
          <span className="p-hair" style={{ background: hairColor }} />
        )}
        {headwear === "gele" ? <span className="p-gele" style={{ background: av!.headwearColor }} /> : null}
        {headwear === "fila" ? <span className="p-fila" style={{ background: av!.headwearColor }} /> : null}
        {headwear === "headwrap" ? <span className="p-headwrap" style={{ background: av!.headwearColor }} /> : null}
        {headwear === "beanie" ? <span className="p-beanie" style={{ background: av!.headwearColor }} /> : null}
        {extras.has("cap") ? <span className="p-cap" /> : null}
        <span className={`p-head face-${expr}`} style={{ background: skin }}>
          <i className="p-brow b1" />
          <i className="p-brow b2" />
          <i className="p-eye e1" style={{ animationDelay: delay }} />
          <i className="p-eye e2" style={{ animationDelay: delay }} />
          <i className="p-mouth" />
          {extras.has("glasses") ? <i className="p-glasses" /> : null}
        </span>
        <span className={`p-torso ${ankaraTop ? "ankara" : ""}`} style={{ backgroundColor: top }} />
        {av?.outfit === "suit" ? <><span className="p-shirtline" /><span className="p-tie" style={{ background: "#111827" }} /></> : null}
        {av?.outfit === "agbada" ? <span className="p-robe ankara" style={{ backgroundColor: top }} /> : null}
        {extras.has("scarf") ? <span className="p-scarf" style={{ background: who === "you" ? "#dc2626" : tint }} /> : null}
        {extras.has("tie") ? <span className="p-tie" style={{ background: tint }} /> : null}
        <span className="p-arm p-arm-l" style={{ background: av?.outfit === "agbada" || av?.outfit === "hoodie" || av?.outfit === "suit" ? top : skin }} />
        <span className="p-arm p-arm-r" style={{ background: av?.outfit === "agbada" || av?.outfit === "hoodie" || av?.outfit === "suit" ? top : skin }}>
          {pose === "phone" ? <b className="p-phone" /> : null}
        </span>
        <span className="p-leg p-leg-l" style={{ background: pants }} />
        <span className="p-leg p-leg-r" style={{ background: pants }} />
        {av && DRESSED_LEGS.has(av.outfit) ? <span className="p-skirt ankara" style={{ backgroundColor: top }} /> : null}
      </div>
    </div>
  );
}
