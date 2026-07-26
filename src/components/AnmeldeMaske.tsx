import { useState, type FormEvent } from "react";
import { anmelden, registrieren } from "../hooks/useAuth";

type Modus = "anmelden" | "registrieren";

export function AnmeldeMaske() {
  const [modus, setModus] = useState<Modus>("anmelden");
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (laeuft) return;
    setMeldung(null);

    if (!email.trim() || !passwort) {
      setMeldung({ text: "E-Mail und Passwort werden gebraucht.", fehler: true });
      return;
    }
    if (modus === "registrieren" && passwort.length < 8) {
      setMeldung({ text: "Das Passwort braucht mindestens 8 Zeichen.", fehler: true });
      return;
    }

    setLaeuft(true);
    try {
      if (modus === "anmelden") {
        await anmelden(email.trim(), passwort);
        // Bei Erfolg übernimmt die Sitzung — die Maske verschwindet von selbst.
      } else {
        const { bestaetigungNoetig } = await registrieren(email.trim(), passwort);
        setMeldung(bestaetigungNoetig
          ? { text: "Fast geschafft — bestätige die E-Mail in deinem Postfach, dann kannst du dich anmelden.", fehler: false }
          : { text: "Willkommen an Bord ⚓", fehler: false });
        if (bestaetigungNoetig) setModus("anmelden");
      }
    } catch (err) {
      setMeldung({
        text: err instanceof Error ? err.message : "Das hat nicht geklappt — nochmal versuchen.",
        fehler: true,
      });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={absenden}>
        <h1 className="auth-title">⚓ Grand Line Assistant</h1>
        <div className="auth-sub">
          {modus === "anmelden" ? "Zurück an Bord" : "Neu anheuern"}
        </div>
        <div className="rule" />

        <label className="auth-field">
          <span className="field-label">E-Mail</span>
          <input className="gla-input" type="email" autoComplete="email" value={email}
            placeholder="kapitaen@grandline.see"
            onChange={e => setEmail(e.target.value)} />
        </label>

        <label className="auth-field">
          <span className="field-label">Passwort</span>
          <input className="gla-input" type="password" value={passwort}
            autoComplete={modus === "anmelden" ? "current-password" : "new-password"}
            placeholder={modus === "registrieren" ? "mindestens 8 Zeichen" : "••••••••"}
            onChange={e => setPasswort(e.target.value)} />
        </label>

        {meldung && (
          <div className={`auth-msg ${meldung.fehler ? "fehler" : ""}`}>{meldung.text}</div>
        )}

        <div className="auth-actions">
          <button className="gla-btn primary" type="submit" disabled={laeuft}>
            {laeuft ? "Moment …" : modus === "anmelden" ? "Anmelden" : "Konto anlegen"}
          </button>
          <button className="auth-switch" type="button"
            onClick={() => { setModus(m => (m === "anmelden" ? "registrieren" : "anmelden")); setMeldung(null); }}>
            {modus === "anmelden" ? "Noch kein Konto? Hier anheuern." : "Schon an Bord? Zur Anmeldung."}
          </button>
        </div>
      </form>

      <p className="auth-hinweis">
        Deine Bögen, Karten und das Logbuch liegen in deinem Konto und sind auf jedem Gerät da.
      </p>
    </div>
  );
}
