import { useState, type FormEvent } from "react";
import { signIn, signUp } from "../hooks/useAuth";

type Mode = "signIn" | "signUp";

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (running) return;
    setMessage(null);

    if (!email.trim() || !password) {
      setMessage({ text: "E-Mail und Passwort werden gebraucht.", error: true });
      return;
    }
    if (mode === "signUp" && password.length < 8) {
      setMessage({ text: "Das Passwort braucht mindestens 8 Zeichen.", error: true });
      return;
    }

    setRunning(true);
    try {
      if (mode === "signIn") {
        await signIn(email.trim(), password);
        // Bei Erfolg übernimmt die Sitzung — die Maske verschwindet von selbst.
      } else {
        const { confirmationRequired } = await signUp(email.trim(), password);
        setMessage(confirmationRequired
          ? { text: "Fast geschafft — bestätige die E-Mail in deinem Postfach, dann kannst du dich anmelden.", error: false }
          : { text: "Willkommen an Bord ⚓", error: false });
        if (confirmationRequired) setMode("signIn");
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Das hat nicht geklappt — nochmal versuchen.",
        error: true,
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1 className="auth-title">⚓ Grand Line Assistant</h1>
        <div className="auth-sub">
          {mode === "signIn" ? "Zurück an Bord" : "Neu anheuern"}
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
          <input className="gla-input" type="password" value={password}
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            placeholder={mode === "signUp" ? "mindestens 8 Zeichen" : "••••••••"}
            onChange={e => setPassword(e.target.value)} />
        </label>

        {message && (
          <div className={`auth-msg ${message.error ? "fehler" : ""}`}>{message.text}</div>
        )}

        <div className="auth-actions">
          <button className="gla-btn primary" type="submit" disabled={running}>
            {running ? "Moment …" : mode === "signIn" ? "Anmelden" : "Konto anlegen"}
          </button>
          <button className="auth-switch" type="button"
            onClick={() => { setMode(m => (m === "signIn" ? "signUp" : "signIn")); setMessage(null); }}>
            {mode === "signIn" ? "Noch kein Konto? Hier anheuern." : "Schon an Bord? Zur Anmeldung."}
          </button>
        </div>
      </form>

      <p className="auth-hinweis">
        Deine Bögen, Karten und das Logbuch liegen in deinem Konto und sind auf jedem Gerät da.
      </p>
    </div>
  );
}
