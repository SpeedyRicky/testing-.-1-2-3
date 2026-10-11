import type { Transit } from "@/game/types";
import { Person } from "./Person";

const COPY: Record<Exclude<Transit, "none">, string> = {
  trek: "Trekking… go-slow of the feet",
  danfo: "Yellow bus. One more passenger!",
  okada: "Okada weaving the potholes",
  call: "Calling Ada in Peckham…",
  plane: "Airside. The country lets go, maybe.",
};

export function TravelRibbon({
  mode,
  destination,
}: {
  mode: Transit;
  destination: string;
}) {
  if (mode === "none") return null;

  return (
    <div className="travel-ribbon" role="status">
      <p className="travel-kicker">{COPY[mode]}</p>
      <p className="travel-dest">{destination}</p>
      <div className="travel-stage">
        {mode === "danfo" ? (
          <div className="danfo-bus">
            <span className="danfo-stripe" />
            <span className="danfo-win w1" />
            <span className="danfo-win w2" />
            <span className="danfo-win w3" />
            <Person who="you" pose="sit" x={52} scale={0.55} caption="You" />
            <Person who="npc" pose="sit" x={38} scale={0.5} />
          </div>
        ) : null}
        {mode === "okada" ? (
          <div className="okada-rig">
            <span className="okada-bike" />
            <Person who="you" pose="idle" x={58} scale={0.7} caption="You" />
            <Person who="npc" pose="idle" x={42} scale={0.65} shirt="#111827" />
          </div>
        ) : null}
        {mode === "trek" ? (
          <>
            <Person who="you" pose="walk" x={48} scale={0.9} caption="You" />
            <Person who="npc" pose="walk" x={22} scale={0.7} delay="0.2s" />
            <Person who="npc" pose="walk" x={74} scale={0.65} delay="0.4s" flip />
          </>
        ) : null}
        {mode === "call" ? (
          <>
            <Person who="you" pose="phone" x={28} scale={1} caption="Tolu" />
            <span className="call-dots">···</span>
            <Person who="ada" pose="phone" x={72} scale={1} caption="Ada · Peckham" />
          </>
        ) : null}
        {mode === "plane" ? (
          <div className="plane-rig">
            <span className="plane-body">✈</span>
            <Person who="you" pose="wave" x={40} scale={0.7} caption="You" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
