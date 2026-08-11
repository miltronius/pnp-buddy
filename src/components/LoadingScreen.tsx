import { useT } from "../i18n";
import type { Translations } from "../i18n/de";

export function LoadingScreen({ textKey = "loading_default" }: { textKey?: keyof Translations }) {
  const t = useT();
  return (
    <div className="lade-schirm">
      <div className="anker" aria-hidden>⚓</div>
      <div style={{ fontStyle: "italic", opacity: .8 }}>{t[textKey] as string}</div>
    </div>
  );
}
