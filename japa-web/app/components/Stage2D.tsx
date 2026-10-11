import { LagosStage } from "./LagosStage";
import { Person } from "./Person";
import { STAGES, type Mood, type StageSpec } from "./stages";
import type { StageKind } from "@/game/types";

const SKY: Record<NonNullable<StageSpec["sky"]>, string> = {
  snow: "lagos-sky sky-snow",
  dayca: "lagos-sky sky-dayca",
  nightca: "lagos-sky sky-nightca",
  "lagos-day": "lagos-sky",
  "lagos-dusk": "lagos-sky dusk",
  "lagos-night": "lagos-sky night",
};

const LAGOS_KINDS = new Set([
  "yaba-dawn", "yaba-street", "cafe", "call-sister", "room-night", "agent", "annex",
  "whatsapp", "gig", "video-job", "embassy", "outside", "phone-text", "airport", "stay",
]);

function Skyline({ kind }: { kind: "toronto" | "lagos" }) {
  if (kind === "toronto") {
    return (
      <>
        <span className="cn-tower" />
        <div className="skyline toronto">
          <i className="bldg b1 glass" />
          <i className="bldg b2" />
          <i className="bldg b3 glass" />
          <i className="bldg b4" />
          <i className="bldg b5 glass" />
        </div>
      </>
    );
  }
  return (
    <div className="skyline">
      <i className="bldg b1" />
      <i className="bldg b2" style={{ background: "#f59e0b" }} />
      <i className="bldg b3" />
      <i className="bldg b4" />
      <i className="bldg b5" />
    </div>
  );
}

function Prop({ p }: { p: NonNullable<StageSpec["props"]>[number] }) {
  const style: React.CSSProperties & Record<string, string | number> = { left: `${p.x}%`, ...(p.w ? { width: p.w } : {}) };
  if (p.kind === "window") {
    return <span className={`window-pane ${p.window ?? ""}`} style={{ left: `calc(${p.x}% - ${(p.w ?? 80) / 2}px)`, width: p.w ?? 80 }} />;
  }
  if (p.kind === "booth") style["--booth"] = p.color ?? "#dc2626";
  const cls = `prop ${p.kind} ${p.tone ?? ""}`;
  return (
    <div className={cls} style={style}>
      {p.label ? <span className="prop-label">{p.label}</span> : null}
      {p.kind === "flag-ca" ? "🍁" : null}
    </div>
  );
}

/** Draws a named stage. Lagos Life's own stages go to LagosStage; everything else uses the spec kit. */
export function SceneStage({ stage, mood = "calm", compact = false }: { stage: StageKind; mood?: Mood; compact?: boolean }) {
  if (LAGOS_KINDS.has(stage)) {
    return <LagosStage scene={stage as Parameters<typeof LagosStage>[0]["scene"]} />;
  }
  const spec = (STAGES as Record<string, StageSpec>)[stage];
  if (!spec) return null;
  return (
    <div className={`stage2d ${compact ? "compact" : ""}`} data-stage={stage}>
      {spec.sky ? <div className={SKY[spec.sky]}><span className="lagos-cloud c1" /><span className="lagos-cloud c2" /></div> : null}
      {spec.wall ? <div className={`wall ${spec.panel ? "panel" : ""}`} style={{ ["--wall" as string]: spec.wall }} /> : null}
      {spec.skyline ? <Skyline kind={spec.skyline} /> : null}
      {spec.ground === "road" ? <div className="road"><span className="lane" /></div> : <div className={`ground ${spec.ground}`} />}
      {(spec.props ?? []).map((p, i) => <Prop key={i} p={p} />)}
      {spec.streetcar ? (
        <div className="streetcar-pass"><span className="streetcar mini" /></div>
      ) : null}
      {spec.people.map((person, i) => {
        const pose = person.moods?.[mood] ?? person.pose ?? "idle";
        const hasTable = (spec.props ?? []).some((p) => p.kind === "table" || p.kind === "desk2");
        return pose === "sit" && !hasTable ? <span key={`chair-${i}`} className="chair" style={{ left: `${person.x}%` }} /> : null;
      })}
      {spec.people.map((person, i) => (
        <Person
          key={`${person.who}-${i}`}
          who={person.who}
          x={person.x}
          pose={person.moods?.[mood] ?? person.pose ?? "idle"}
          caption={person.caption}
          scale={person.scale ?? (compact ? 0.85 : 1)}
          flip={person.flip}
          delay={person.delay}
          shirt={person.shirt}
          wear={person.wear}
        />
      ))}
      {spec.snow ? <div className="snowfall" /> : null}
    </div>
  );
}
