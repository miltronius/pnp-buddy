import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AbilityKey, OriginType, ActionType as AktionsTyp } from '../types/dnd';
import { de, type Translations } from './de';
import { en } from './en';

export type Lang = 'de' | 'en';

const TRANSLATIONS: Record<Lang, Translations> = { de, en };

const LS_KEY = 'gla:lang';

function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === 'de' || v === 'en') return v;
  } catch { /* ignore */ }
  return 'de';
}

interface LangCtxValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangCtx = createContext<LangCtxValue>({ lang: 'de', setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(LS_KEY, l); } catch { /* ignore */ }
  }

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

export function useT(): Translations {
  const { lang } = useContext(LangCtx);
  return TRANSLATIONS[lang];
}

// ── Translated game-data label maps ────────────────────────────────────────

export function useGameLabels() {
  const t = useT();

  const ABILITY_NAMES: Record<AbilityKey, string> = {
    STR: t.ability_str,
    DEX: t.ability_dex,
    CON: t.ability_con,
    INT: t.ability_int,
    WIS: t.ability_wis,
    CHA: t.ability_cha,
  };

  const ABILITY_SHORT: Record<AbilityKey, string> = {
    STR: t.ability_short_str,
    DEX: t.ability_short_dex,
    CON: t.ability_short_con,
    INT: t.ability_short_int,
    WIS: t.ability_short_wis,
    CHA: t.ability_short_cha,
  };

  const SOURCE_LABEL: Record<OriginType, string> = {
    SPECIES:    t.source_species,
    CLASS:      t.source_class,
    SUBCLASS:   t.source_subclass,
    FEAT:       t.source_feat,
    BACKGROUND: t.source_background,
    UNIVERSAL:  t.source_universal,
  };

  const ACTION_LABEL: Record<AktionsTyp, string> = {
    ACTION:   t.action_action,
    BONUS:    t.action_bonus,
    REACTION: t.action_reaction,
    FREE:     t.action_free,
    NONE:     t.action_none,
  };

  const SKILL_NAMES: Record<string, string> = {
    athletics:       t.skill_athletics,
    acrobatics:      t.skill_acrobatics,
    sleight_of_hand: t.skill_sleight_of_hand,
    stealth:         t.skill_stealth,
    arcana:          t.skill_arcana,
    history:         t.skill_history,
    investigation:   t.skill_investigation,
    nature:          t.skill_nature,
    religion:        t.skill_religion,
    animal_handling: t.skill_animal_handling,
    insight:         t.skill_insight,
    medicine:        t.skill_medicine,
    perception:      t.skill_perception,
    survival:        t.skill_survival,
    deception:       t.skill_deception,
    intimidation:    t.skill_intimidation,
    performance:     t.skill_performance,
    persuasion:      t.skill_persuasion,
  };

  return { ABILITY_NAMES, ABILITY_SHORT, SOURCE_LABEL, ACTION_LABEL, SKILL_NAMES };
}

// ── Language toggle component ──────────────────────────────────────────────

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={className ?? 'lang-toggle-group'}>
      <button
        className={`lang-toggle-btn ${lang === 'de' ? 'active' : ''}`}
        onClick={() => setLang('de')}
        title="Zu Deutsch wechseln"
      >DE</button>
      <button
        className={`lang-toggle-btn ${lang === 'en' ? 'active' : ''}`}
        onClick={() => setLang('en')}
        title="Switch to English"
      >EN</button>
    </div>
  );
}
