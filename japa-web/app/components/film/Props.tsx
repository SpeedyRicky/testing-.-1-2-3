"use client";
// The things people hand over and hold in the film: small SVG props for wide shots, and big close-up inserts.
import type { Moment, PropKind } from "@/game/moments";
import type { Mood } from "@/game/film";
import { usePlayer } from "../Player";

/** A prop drawn around (0, 0), about 120 wide, for an actor's hands. */
export function PropSvg({ kind }: { kind: PropKind }) {
  switch (kind) {
    case "passport":
      return <g><rect x="-42" y="-56" width="84" height="112" rx="8" fill="#14532d" /><circle cx="0" cy="-10" r="20" fill="none" stroke="#facc15" strokeWidth="5" />
        <rect x="-26" y="26" width="52" height="7" rx="3" fill="#facc15" /></g>;
    case "laptop":
      return <g><rect x="-80" y="-70" width="160" height="100" rx="8" fill="#1f2937" /><rect x="-70" y="-62" width="140" height="84" fill="#93c5fd" />
        <rect x="-96" y="30" width="192" height="14" rx="6" fill="#9ca3af" /></g>;
    case "phone":
      return <g><rect x="-26" y="-48" width="52" height="96" rx="10" fill="#111827" /><rect x="-20" y="-38" width="40" height="72" rx="4" fill="#60a5fa" /></g>;
    case "cash":
      return <g>{[0, 1, 2].map((i) => <rect key={i} x={-60 + i * 4} y={-30 - i * 8} width="120" height="56" rx="4" fill="#4d7c0f" stroke="#a3e635" strokeWidth="4" />)}</g>;
    case "envelope":
      return <g><rect x="-70" y="-46" width="140" height="92" rx="4" fill="#d6b98c" /><path d="M-70 -46 L0 8 L70 -46" fill="none" stroke="#a07a4a" strokeWidth="5" />
        <circle cx="0" cy="8" r="13" fill="#b91c1c" /></g>;
    case "payslip":
    case "receipt":
      return <g><rect x="-36" y="-60" width="72" height="120" fill="#fafaf9" />{[-40, -24, -8, 8, 24].map((y) => <rect key={y} x="-26" y={y} width={y === 24 ? 34 : 52} height="6" fill="#a8a29e" />)}</g>;
    case "notebook":
      return <g><rect x="-60" y="-44" width="120" height="88" rx="6" fill="#1e3a8a" /><rect x="-52" y="-38" width="104" height="76" rx="4" fill="#fafaf9" />
        {[-24, -10, 4, 18].map((y) => <rect key={y} x="-40" y={y} width="80" height="4" fill="#93c5fd" />)}<rect x="-4" y="-44" width="8" height="88" fill="#1e3a8a" /></g>;
    case "notepad":
      return <g><rect x="-40" y="-54" width="80" height="108" rx="4" fill="#fef9c3" /><rect x="-40" y="-54" width="80" height="14" fill="#a16207" />
        {[-26, -12, 2, 16, 30].map((y) => <rect key={y} x="-30" y={y} width={y === 30 ? 30 : 60} height="4" fill="#78716c" />)}</g>;
    case "box":
      return <g><rect x="-70" y="-60" width="140" height="110" fill="#c08a5a" stroke="#8b5e34" strokeWidth="5" /><rect x="-70" y="-60" width="140" height="20" fill="#a16207" opacity="0.5" /></g>;
    case "keys":
      return <g fill="none" stroke="#facc15" strokeWidth="7"><circle cx="-20" cy="-10" r="18" /><path d="M-4 -4 L44 14 M30 9 L26 22 M40 13 L36 26" /></g>;
    case "document":
      return <g><rect x="-48" y="-62" width="96" height="124" fill="#e7e5e4" />{[-40, -26, -12, 2, 16].map((y) => <rect key={y} x="-36" y={y} width="72" height="6" fill="#a8a29e" />)}
        <circle cx="26" cy="38" r="14" fill="none" stroke="#b91c1c" strokeWidth="4" /></g>;
    case "bag":
      return <g><rect x="-56" y="-40" width="112" height="96" rx="8" fill="#b45309" /><path d="M-30 -40 Q-30 -76 0 -76 Q30 -76 30 -40" fill="none" stroke="#78350f" strokeWidth="8" /></g>;
    default: // letter
      return <g><rect x="-50" y="-66" width="100" height="132" fill="#fafaf9" /><rect x="-50" y="-66" width="100" height="22" fill="#b91c1c" />
        {[-30, -16, -2, 12, 26].map((y) => <rect key={y} x="-38" y={y} width={y === 26 ? 40 : 76} height="6" fill="#a8a29e" />)}</g>;
  }
}

/** A moment's line on screen: "{choice}" is the choice itself, "{amount}" the money; anything else is translated. */
export function useLine(choice: string, amount: string) {
  const { t } = usePlayer();
  return (l: string) => (l === "{choice}" ? choice : l === "{amount}" ? amount : t(l));
}

/** The item, close up, filling the frame: what's written on it, line by line. */
export function ItemInsert({ moment, mood, choice, amount }: { moment: Moment; mood: Mood; choice: string; amount: string }) {
  const { t } = usePlayer();
  const say = useLine(choice, amount);
  if (moment.prop === "passport") {
    return (
      <div className="ins ins-passport">
        <div className="passport-open">
          <div className="pp-page pp-left"><b>{t(moment.title)}</b>{moment.lines.map((l) => <span key={l}>{t(l)}</span>)}</div>
          <div className="pp-page pp-right">
            <span className={`pp-stamp ${mood === "down" ? "bad" : ""}`}>{moment.kind === "landing" ? t("Admitted") : "VISA"}</span>
          </div>
        </div>
      </div>
    );
  }
  const narrow = moment.prop === "payslip" || moment.prop === "receipt" || moment.prop === "bag" || moment.prop === "phone";
  return (
    <div className="ins ins-item">
      <div className={`paper big item-${moment.prop} ${narrow ? "narrow" : ""}`}>
        <b>{t(moment.title)}</b>
        {moment.lines.map((l, i) => say(l) ? <span key={l} className="item-line" style={{ ["--i" as string]: i }}>{say(l)}</span> : null)}
        {moment.prop === "envelope" ? <span className="seal">SEALED</span> : null}
        {moment.prop === "cash" ? <span className="stamp tone-bad">{t("No receipt.")}</span> : null}
      </div>
    </div>
  );
}

/** The portal, the inbox or your bank app: loading, then the answer. */
export function ScreenInsert({ moment, mood, choice, amount }: { moment: Moment; mood: Mood; choice: string; amount: string }) {
  const { t } = usePlayer();
  const say = useLine(choice, amount);
  return (
    <div className="ins ins-screen">
      <div className={moment.prop === "phone" ? "f-laptop as-phone" : "f-laptop"}>
        <div className="f-laptop-screen">
          <div className="screen-loading"><i className="spinner" />{t("Loading…")}</div>
          <div className={`screen-result ${mood}`}>
            <b>{t(moment.title)}</b>
            {moment.lines.map((l) => (say(l) ? <span key={l}>{say(l)}</span> : null))}
          </div>
        </div>
        {moment.prop === "phone" ? null : <div className="f-laptop-base" />}
      </div>
    </div>
  );
}

/** The phone ringing out. */
export function DialInsert({ name }: { name: string }) {
  const { t } = usePlayer();
  return (
    <div className="ins ins-dial">
      <div className="phone dial">
        <div className="dial-avatar">{name.slice(0, 1)}</div>
        <b>{name}</b>
        <span>{t("Calling…")}</span>
        <i className="ring r1" /><i className="ring r2" />
      </div>
    </div>
  );
}

/** Their notepad, close up: what they wrote while you talked. */
export function NotesInsert({ note, who }: { note: string; who: string }) {
  return (
    <div className="ins ins-notes">
      <div className="notepad">
        <small>{who}</small>
        <i /><i /><i />
        <b>{note}</b>
      </div>
    </div>
  );
}

/** Your pick, pinned on the board with red string to where you are now. */
export function BoardInsert({ choice, caption }: { choice: string; caption: string }) {
  return (
    <div className="ins ins-board">
      <div className="corkboard">
        <span className="pin-card home">🇳🇬</span>
        <span className="pin-card pick"><b>{caption}</b>{choice}</span>
        <svg className="string" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden><path d="M18 70 Q50 30 74 34" /></svg>
      </div>
    </div>
  );
}
