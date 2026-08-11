import { useState } from "react";
import type { SystemName, TabName } from "../types";
import { signOut } from "../hooks/useAuth";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { useT, LangToggle } from "../i18n";
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
  const t = useT();

  function setSystem(s: SystemName) {
    setSystemRaw(s);
    try { localStorage.setItem("gla:system", s); } catch { /* ignorieren */ }
  }

  if (loading) return <LoadingScreen textKey="loading_log" />;

  const SYSTEME: { id: SystemName; label: string }[] = [
    { id: "pnp", label: t.system_pnp },
    { id: "dnd", label: t.system_dnd },
  ];

  const TABS: { id: TabName; label: string }[] = [
    { id: "sheet",       label: t.tab_bogen },
    { id: "dice",        label: t.tab_wuerfel },
    { id: "combat",      label: t.tab_kampf },
    { id: "map",         label: t.tab_karte },
    { id: "cartography", label: t.tab_zeichnen },
    { id: "scene",       label: t.tab_detail },
    { id: "logbook",     label: t.tab_notizen },
    { id: "crew",        label: t.tab_crew },
  ];

  const STATUS_TEXT: Record<string, string> = {
    idle: "",
    saving: t.gla_saving,
    saved:  t.gla_saved,
    error:  t.gla_unsaved,
  };

  return (
    <div className="gla-root">
      <div className="gla-topbar">
        <span className={`speicher-status ${saveStatus === "error" ? "fehler" : ""}`}
          title={saveError ?? undefined}>
          {storage.mode === "local" && `${t.gla_local_only} · `}
          {STATUS_TEXT[saveStatus]}
        </span>
        <LangToggle />
        {email && (
          <>
            <span className="konto">{email}</span>
            <button className="abmelden" onClick={() => void signOut()}>{t.gla_logout}</button>
          </>
        )}
      </div>

      <nav className="system-tabs">
        {SYSTEME.map(s => (
          <button key={s.id} className={`system-tab ${system === s.id ? "active" : ""}`}
            onClick={() => setSystem(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>

      {system === "pnp" && (
        <>
          <header className="gla-header">
            <h1>{t.gla_header}</h1>
            <div className="sub">{t.gla_subtitle}</div>
          </header>

          {loadError && (
            <p className="auth-hinweis" style={{ margin: "0 auto 12px", color: "#ef6a52" }}>
              {t.gla_load_error}: {loadError}
            </p>
          )}

          <nav className="gla-tabs">
            {TABS.map(tab_ => (
              <button key={tab_.id} className={`gla-tab ${tab === tab_.id ? "active" : ""}`}
                onClick={() => setTab(tab_.id)}>
                {tab_.label}
              </button>
            ))}
          </nav>

          {tab === "sheet"       && <CharacterSheet />}
          {tab === "dice"        && <DiceTable />}
          {tab === "combat"      && <CombatTracker />}
          {tab === "map"         && <MapTracker />}
          {tab === "cartography" && <Cartography />}
          {tab === "scene"       && <Scene />}
          {tab === "logbook"     && <Logbook />}
          {tab === "crew"        && <WantedPosters />}

          <DiceOverlay />
        </>
      )}

      {system === "dnd" && <DnDAssistant />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
