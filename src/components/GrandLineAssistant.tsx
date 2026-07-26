import type { TabName } from "../types";
import { abmelden } from "../hooks/useAuth";
import { useKampagne } from "../state/KampagneContext";
import { useSitzung } from "../state/SitzungContext";
import { Charakterbogen } from "./Charakterbogen";
import { KampfTracker } from "./KampfTracker";
import { Kartografie } from "./Kartografie";
import { KartenTracker } from "./KartenTracker";
import { Ladebildschirm } from "./Ladebildschirm";
import { Logbuch } from "./Logbuch";
import { Schauplatz } from "./Schauplatz";
import { Steckbriefe } from "./Steckbriefe";
import { WuerfelOverlay } from "./WuerfelOverlay";
import { Wuerfeltisch } from "./Wuerfeltisch";

const TABS: { id: TabName; titel: string }[] = [
  { id: "bogen", titel: "Charakterbogen" },
  { id: "wuerfel", titel: "Würfeltisch" },
  { id: "kampf", titel: "Kampf ⚔" },
  { id: "karte", titel: "Karte 🗺" },
  { id: "zeichnen", titel: "Kartografie ✎" },
  { id: "detail", titel: "Schauplatz ⌗" },
  { id: "notizen", titel: "Logbuch ✒" },
  { id: "crew", titel: "Steckbriefe ☠" },
];

const STATUS_TEXT = {
  ruhig: "",
  speichert: "speichert …",
  gespeichert: "gespeichert ⚓",
  fehler: "nicht gespeichert",
} as const;

export function GrandLineAssistant({ email }: { email?: string | null }) {
  const { laedt, ladefehler, speicher, speicherStatus, speicherFehler, toast } = useKampagne();
  const { tab, setTab } = useSitzung();

  if (laedt) return <Ladebildschirm text="Logbuch wird geöffnet …" />;

  return (
    <div className="gla-root">
      <div className="gla-topbar">
        <span className={`speicher-status ${speicherStatus === "fehler" ? "fehler" : ""}`}
          title={speicherFehler ?? undefined}>
          {speicher.modus === "lokal" && "nur auf diesem Gerät · "}
          {STATUS_TEXT[speicherStatus]}
        </span>
        {email && (
          <>
            <span className="konto">{email}</span>
            <button className="abmelden" onClick={() => void abmelden()}>Abmelden</button>
          </>
        )}
      </div>

      <header className="gla-header">
        <h1>⚓ Grand Line Assistant</h1>
        <div className="sub">Logbuch eurer Kampagne — Bögen, Würfel &amp; Beute</div>
      </header>

      {ladefehler && (
        <p className="auth-hinweis" style={{ margin: "0 auto 12px", color: "#ef6a52" }}>
          Daten konnten nicht geladen werden: {ladefehler}
        </p>
      )}

      <nav className="gla-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`gla-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}>
            {t.titel}
          </button>
        ))}
      </nav>

      {tab === "bogen" && <Charakterbogen />}
      {tab === "wuerfel" && <Wuerfeltisch />}
      {tab === "kampf" && <KampfTracker />}
      {tab === "karte" && <KartenTracker />}
      {tab === "zeichnen" && <Kartografie />}
      {tab === "detail" && <Schauplatz />}
      {tab === "notizen" && <Logbuch />}
      {tab === "crew" && <Steckbriefe />}

      <WuerfelOverlay />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
