import { useState, type FormEvent } from "react";
import { signIn, signInWithMagicLink, signUp } from "../hooks/useAuth";
import { useT } from "../i18n";

type Mode = "signIn" | "signUp";
type LoginMethod = "password" | "magic";

export function LoginScreen() {
  const t = useT();
  const [mode, setMode] = useState<Mode>("signIn");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setMessage(null);
  }

  function switchMethod(next: LoginMethod) {
    setLoginMethod(next);
    setMessage(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (running) return;
    setMessage(null);

    if (!email.trim()) {
      setMessage({ text: t.login_required, error: true });
      return;
    }

    if (mode === "signIn" && loginMethod === "magic") {
      setRunning(true);
      try {
        await signInWithMagicLink(email.trim());
        setMagicLinkSent(true);
      } catch (err) {
        setMessage({ text: err instanceof Error ? err.message : t.login_error, error: true });
      } finally {
        setRunning(false);
      }
      return;
    }

    if (!password) {
      setMessage({ text: t.login_required, error: true });
      return;
    }
    if (mode === "signUp" && password.length < 8) {
      setMessage({ text: t.login_too_short, error: true });
      return;
    }

    setRunning(true);
    try {
      if (mode === "signIn") {
        await signIn(email.trim(), password);
      } else {
        const { confirmationRequired } = await signUp(email.trim(), password);
        setMessage(confirmationRequired
          ? { text: t.login_confirm_email, error: false }
          : { text: t.login_welcome, error: false });
        if (confirmationRequired) switchMode("signIn");
      }
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t.login_error, error: true });
    } finally {
      setRunning(false);
    }
  }

  if (magicLinkSent) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-title">⚓ Grand Line Assistant</h1>
          <div className="rule" />
          <p className="auth-sub" style={{ textAlign: "center", marginTop: "1rem" }}>
            {t.login_magic_sent}
          </p>
          <div className="auth-actions" style={{ marginTop: "1.5rem" }}>
            <button className="auth-switch" type="button"
              onClick={() => { setMagicLinkSent(false); setMessage(null); }}>
              {t.login_magic_back}
            </button>
          </div>
        </div>
        <p className="auth-hinweis">{t.login_info}</p>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1 className="auth-title">⚓ Grand Line Assistant</h1>
        <div className="auth-sub">
          {mode === "signIn" ? t.login_back : t.login_new}
        </div>
        <div className="rule" />

        {mode === "signIn" && (
          <div className="auth-method-toggle">
            <button
              type="button"
              className={`auth-method-btn${loginMethod === "password" ? " active" : ""}`}
              onClick={() => switchMethod("password")}
            >
              {t.login_method_password}
            </button>
            <button
              type="button"
              className={`auth-method-btn${loginMethod === "magic" ? " active" : ""}`}
              onClick={() => switchMethod("magic")}
            >
              {t.login_method_magic}
            </button>
          </div>
        )}

        <label className="auth-field">
          <span className="field-label">{t.login_email}</span>
          <input className="gla-input" type="email" autoComplete="email" value={email}
            placeholder={t.login_email_placeholder}
            onChange={e => setEmail(e.target.value)} />
        </label>

        {(mode === "signUp" || loginMethod === "password") && (
          <label className="auth-field">
            <span className="field-label">{t.login_password}</span>
            <input className="gla-input" type="password" value={password}
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              placeholder={mode === "signUp" ? t.login_password_placeholder_new : t.login_password_placeholder_existing}
              onChange={e => setPassword(e.target.value)} />
          </label>
        )}

        {message && (
          <div className={`auth-msg ${message.error ? "fehler" : ""}`}>{message.text}</div>
        )}

        <div className="auth-actions">
          <button className="gla-btn primary" type="submit" disabled={running}>
            {running
              ? t.login_loading
              : mode === "signIn" && loginMethod === "magic"
                ? t.login_magic_send
                : mode === "signIn"
                  ? t.login_signin
                  : t.login_signup}
          </button>
          <button className="auth-switch" type="button"
            onClick={() => switchMode(mode === "signIn" ? "signUp" : "signIn")}>
            {mode === "signIn" ? t.login_no_account : t.login_has_account}
          </button>
        </div>
      </form>

      <p className="auth-hinweis">{t.login_info}</p>
    </div>
  );
}
