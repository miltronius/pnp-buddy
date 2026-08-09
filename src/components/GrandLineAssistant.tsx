import { useState } from "react";
import type { SystemName, TabName } from "../types";
import { signOut } from "../hooks/useAuth";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { CharacterSheet } from "./CharacterSheet";
import { DnDAssistant } from "./DnDAssistant";
import { CombatTracker } from "./CombatTracker";
import { Cartography } from "./Cartography";
import { MapTracker } from "./MapTracker";
import { LoadingScreen } from "./LoadingScreen";
import { Logbook } from "./Logbook";
import { Scene } from "./Scene";
import { WantedPosters } from "./WantedPosters";
import { DiceOverlay } from "./DiceOverlay";
import { DiceTable } from "./DiceTable";

const SYSTEME: { id: SystemName; titel: string }[] = [
  { id: "pnp", titel: "⚓ PnP — Grand Line" },
  { id: "dnd", titel: "🐉 D&D" },
];

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

const STATUS_TEXT: Record<string, string> = {
  idle: "",
  saving: "speichert …",
  saved: "gespeichert ⚓",
  error: "nicht gespeichert",
};

function loadSystem(): SystemName {
  try {
    const v = localStorage.getItem("gla:system");
    if (v === "pnp" || v === "dnd") return v;
  } catch { /* kein localStorage */ }
  return "pnp";
}

export function GrandLineAssistant({ email }: { email?: string | null }) {
  const { loading, loadError, storage, saveStatus, saveError, toast } = useCampaign();
  const { tab, setTab } = useSession();
  const [system, setSystemRaw] = useState<SystemName>(loadSystem);

  function setSystem(s: SystemName) {
    setSystemRaw(s);
    try { localStorage.setItem("gla:system", s); } catch { /* ignorieren */ }
  }

  if (loading) return <LoadingScreen text="Logbuch wird geöffnet …" />;

  return (
    <div className="gla-root">
      <div className="gla-topbar">
        <span className={`speicher-status ${saveStatus === "error" ? "fehler" : ""}`}
          title={saveError ?? undefined}>
          {storage.modus === "lokal" && "nur auf diesem Gerät · "}
          {STATUS_TEXT[saveStatus]}
        </span>
        {email && (
          <>
            <span className="konto">{email}</span>
            <button className="abmelden" onClick={() => void signOut()}>Abmelden</button>
          </>
        )}
      </div>

      <nav className="system-tabs">
        {SYSTEME.map(s => (
          <button key={s.id} className={`system-tab ${system === s.id ? "active" : ""}`}
            onClick={() => setSystem(s.id)}>
            {s.titel}
          </button>
        ))}
      </nav>

      {system === "pnp" && (
        <>
          <header className="gla-header">
            <h1>⚓ Grand Line Assistant</h1>
            <div className="sub">Logbuch eurer Kampagne — Bögen, Würfel &amp; Beute</div>
          </header>

          {loadError && (
            <p className="auth-hinweis" style={{ margin: "0 auto 12px", color: "#ef6a52" }}>
              Daten konnten nicht geladen werden: {loadError}
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

          {tab === "bogen" && <CharacterSheet />}
          {tab === "wuerfel" && <DiceTable />}
          {tab === "kampf" && <CombatTracker />}
          {tab === "karte" && <MapTracker />}
          {tab === "zeichnen" && <Cartography />}
          {tab === "detail" && <Scene />}
          {tab === "notizen" && <Logbook />}
          {tab === "crew" && <WantedPosters />}

          <DiceOverlay />
        </>
      )}

      {system === "dnd" && <DnDAssistant />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
