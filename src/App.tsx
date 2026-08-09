import { LoginScreen } from "./components/LoginScreen";
import { GrandLineAssistant } from "./components/GrandLineAssistant";
import { LoadingScreen } from "./components/LoadingScreen";
import { useAuth } from "./hooks/useAuth";
import { CampaignProvider } from "./state/CampaignContext";
import { SessionProvider } from "./state/SessionContext";

export default function App() {
  const { user, loading, cloud } = useAuth();

  if (loading) return <LoadingScreen />;

  // Mit Supabase-Projekt: ohne Anmeldung geht nichts.
  // Ohne Projekt: die App läuft im lokalen Modus weiter, damit man
  // sofort spielen kann und die Zugangsdaten später nachreicht.
  if (cloud && !user) return <LoginScreen />;

  return (
    <CampaignProvider userId={user?.id ?? null}>
      <SessionProvider>
        <GrandLineAssistant email={user?.email ?? null} />
      </SessionProvider>
    </CampaignProvider>
  );
}
