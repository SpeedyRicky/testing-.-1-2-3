import type { StageKind as SceneKind } from "@/game/types";
import { Person } from "./Person";

function Sky({ dusk = false, night = false }: { dusk?: boolean; night?: boolean }) {
  const cls = night
    ? "lagos-sky night"
    : dusk
      ? "lagos-sky dusk"
      : "lagos-sky";
  return (
    <div className={cls}>
      <span className="lagos-sun" />
      <span className="lagos-cloud c1" />
      <span className="lagos-cloud c2" />
    </div>
  );
}

function Buildings({ accent = "#f59e0b" }: { accent?: string }) {
  return (
    <div className="skyline">
      <i className="bldg b1" />
      <i className="bldg b2" style={{ background: accent }} />
      <i className="bldg b3" />
      <i className="bldg b4" />
      <i className="bldg b5" />
    </div>
  );
}

function Road() {
  return (
    <div className="road">
      <span className="lane" />
    </div>
  );
}

function Shop({ label, x }: { label: string; x: number }) {
  return (
    <div className="shop" style={{ left: `${x}%` }}>
      <span>{label}</span>
    </div>
  );
}

function AdaInset() {
  return (
    <div className="ada-inset">
      <p>Ada · Peckham</p>
      <Person who="ada" pose="phone" x={50} scale={0.85} />
    </div>
  );
}

export function LagosStage({ scene }: { scene: SceneKind }) {
  return (
    <div className="lagos-stage" data-scene={scene}>
      {scene === "yaba-dawn" ? (
        <>
          <Sky />
          <Buildings />
          <Shop label="PURE WATER" x={12} />
          <Shop label="YABA MARKET" x={62} />
          <div className="genny">GEN</div>
          <Road />
          <Person who="roommate" pose="sit" x={22} caption="Roommate" />
          <Person who="you" pose="phone" x={48} caption="Tolu" />
          <Person who="npc" pose="walk" x={78} delay="0.3s" />
          <AdaInset />
        </>
      ) : null}

      {scene === "yaba-street" ? (
        <>
          <Sky dusk />
          <Buildings accent="#fb7185" />
          <Shop label="PEPPER SOUP" x={8} />
          <Shop label="GLO / MTN" x={70} />
          <Road />
          <div className="danfo-pass">
            <span className="danfo-bus mini">
              <span className="danfo-stripe" />
            </span>
          </div>
          <Person who="preacher" pose="wave" x={18} caption="Preacher" />
          <Person who="you" pose="idle" x={44} caption="Tolu" />
          <Person who="npc" pose="walk" x={62} delay="0s" shirt="#db2777" />
          <Person who="npc" pose="walk" x={84} delay="0.5s" flip />
          <Person who="npc" pose="phone" x={30} scale={0.75} delay="0.2s" />
        </>
      ) : null}

      {scene === "cafe" ? (
        <>
          <Sky />
          <Buildings accent="#38bdf8" />
          <Shop label="CYBER CAFE" x={18} />
          <Shop label="PHONE PARTS" x={58} />
          <Road />
          <div className="desk">
            <span className="laptop" />
          </div>
          <Person who="you" pose="sit" x={40} caption="Tolu" />
          <Person who="npc" pose="walk" x={72} />
          <Person who="clerk" pose="idle" x={18} caption="Cafe guy" />
          <AdaInset />
        </>
      ) : null}

      {scene === "call-sister" ? (
        <>
          <div className="split-call">
            <div className="call-pane lagos">
              <p>Yaba · generator light</p>
              <Sky night />
              <Person who="you" pose="phone" x={50} scale={1.15} caption="Tolu" />
            </div>
            <div className="call-pulse" />
            <div className="call-pane peckham">
              <p>Peckham · grey morning</p>
              <div className="uk-brick" />
              <Person who="ada" pose="phone" x={50} scale={1.15} caption="Ada" />
            </div>
          </div>
        </>
      ) : null}

      {scene === "room-night" ? (
        <>
          <Sky night />
          <div className="room-wall" />
          <div className="desk night-desk">
            <span className="laptop glow" />
          </div>
          <Person who="you" pose="sit" x={46} caption="Tolu" />
          <Person who="roommate" pose="idle" x={78} scale={0.8} />
          <AdaInset />
        </>
      ) : null}

      {scene === "agent" ? (
        <>
          <div className="office" />
          <Shop label="VISA EXPRESS" x={8} />
          <Person who="agent" pose="idle" x={28} caption="Consultant" />
          <Person who="you" pose="queue" x={58} caption="Tolu" />
          <Person who="npc" pose="sit" x={80} scale={0.8} />
        </>
      ) : null}

      {scene === "annex" ? (
        <>
          <Sky />
          <Buildings accent="#64748b" />
          <Shop label="ANNEX" x={6} />
          <Road />
          <Person who="clerk" pose="wave" x={18} caption="Clerk" />
          <Person who="you" pose="queue" x={40} caption="Tolu" />
          <Person who="npc" pose="queue" x={52} delay="0.1s" />
          <Person who="npc" pose="queue" x={64} delay="0.2s" shirt="#7c3aed" />
          <Person who="npc" pose="queue" x={76} delay="0.3s" />
        </>
      ) : null}

      {scene === "whatsapp" ? (
        <>
          <div className="split-call">
            <div className="call-pane lagos">
              <p>Family group</p>
              <Person who="you" pose="phone" x={50} caption="Tolu" />
            </div>
            <div className="call-pane peckham">
              <p>Ada sent a photo</p>
              <Person who="ada" pose="wave" x={50} caption="Ada" />
            </div>
          </div>
        </>
      ) : null}

      {scene === "gig" ? (
        <>
          <Sky dusk />
          <Buildings />
          <Shop label="POS FIX" x={14} />
          <div className="rain" />
          <Road />
          <div className="okada-pass">
            <span className="okada-bike" />
          </div>
          <Person who="you" pose="walk" x={50} caption="Tolu" />
          <Person who="npc" pose="phone" x={24} caption="I am coming" />
          <Person who="npc" pose="walk" x={78} flip />
        </>
      ) : null}

      {scene === "video-job" ? (
        <>
          <Sky night />
          <div className="desk night-desk">
            <span className="laptop glow" />
          </div>
          <Person who="you" pose="sit" x={36} caption="Tolu" />
          <Person who="ada" pose="phone" x={72} caption="Ada on speaker" />
        </>
      ) : null}

      {scene === "embassy" ? (
        <>
          <div className="office cool" />
          <Shop label="VAC" x={10} />
          <Person who="clerk" pose="idle" x={20} caption="Officer" />
          <Person who="you" pose="queue" x={42} caption="Tolu" />
          <Person who="npc" pose="phone" x={56} caption="Houston" />
          <Person who="npc" pose="queue" x={70} />
          <Person who="npc" pose="queue" x={82} delay="0.2s" />
        </>
      ) : null}

      {scene === "outside" ? (
        <>
          <Sky />
          <Buildings accent="#fde68a" />
          <Road />
          <Person who="you" pose="phone" x={46} caption="Tolu" />
          <Person who="npc" pose="walk" x={70} />
          <AdaInset />
        </>
      ) : null}

      {scene === "phone-text" ? (
        <>
          <Sky night />
          <div className="room-wall" />
          <Person who="you" pose="phone" x={42} caption="Tolu" />
          <AdaInset />
        </>
      ) : null}

      {scene === "airport" ? (
        <>
          <Sky />
          <Buildings accent="#94a3b8" />
          <Shop label="MMA2" x={12} />
          <Road />
          <Person who="you" pose="wave" x={38} caption="Tolu" />
          <Person who="clerk" pose="idle" x={18} caption="Scanner" />
          <Person who="npc" pose="walk" x={62} />
          <AdaInset />
        </>
      ) : null}

      {scene === "stay" ? (
        <>
          <Sky dusk />
          <Buildings />
          <div className="genny">GEN</div>
          <Road />
          <Person who="you" pose="phone" x={44} caption="Tolu" />
          <Person who="roommate" pose="idle" x={68} />
          <AdaInset />
        </>
      ) : null}
    </div>
  );
}
