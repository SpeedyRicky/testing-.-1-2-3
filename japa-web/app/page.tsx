import { Game } from "@/app/components/Game";
import { SoundProvider } from "@/app/components/Sound";

export default function Home() {
  return (
    <SoundProvider>
      <Game />
    </SoundProvider>
  );
}
