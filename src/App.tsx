import { AnmeldeMaske } from "./components/AnmeldeMaske";
import { GrandLineAssistant } from "./components/GrandLineAssistant";
import { Ladebildschirm } from "./components/Ladebildschirm";
import { useAuth } from "./hooks/useAuth";
import { KampagneProvider } from "./state/KampagneContext";
import { SitzungProvider } from "./state/SitzungContext";

export default function App() {
  const { user, laedt, cloud } = useAuth();

  if (laedt) return <Ladebildschirm />;

  // Mit Supabase-Projekt: ohne Anmeldung geht nichts.
  // Ohne Projekt: die App läuft im lokalen Modus weiter, damit man
  // sofort spielen kann und die Zugangsdaten später nachreicht.
  if (cloud && !user) return <AnmeldeMaske />;

  return (
    <KampagneProvider userId={user?.id ?? null}>
      <SitzungProvider>
        <GrandLineAssistant email={user?.email ?? null} />
      </SitzungProvider>
    </KampagneProvider>
  );
}
