import { SPELL_NAMES_DE } from "../data/dndSpellNames";
import rohdaten from "../data/dndSpells.json";

export interface SpellDBEintrag {
  slug: string;
  name: string;
  nameDe: string;
  stufe: number;
  schule: string;
  aktion: string;
  konzentration: boolean;
  beschreibung: string;
  komponenten: string;
  reichweite: string;
  isHomebrew: boolean;
  sourceDoc: string;
}

interface RohEintrag {
  slug?: string;
  name: string;
  stufe: number;
  schule: string;
  aktion: string;
  konzentration: boolean;
  beschreibung: string;
  komponenten: string;
  reichweite: string;
  isHomebrew?: boolean;
  sourceDoc?: string;
}

const DB: SpellDBEintrag[] = (rohdaten as RohEintrag[]).map(z => ({
  ...z,
  slug: z.slug ?? z.name.toLowerCase().replace(/\s+/g, "-"),
  nameDe: SPELL_NAMES_DE[z.name] ?? z.name,
  isHomebrew: z.isHomebrew ?? false,
  sourceDoc: z.sourceDoc ?? "",
}));

export function spellSuche(
  suchbegriff: string,
  opts: { nurSRD?: boolean; max?: number } = {},
): SpellDBEintrag[] {
  if (!suchbegriff.trim()) return [];
  const q = suchbegriff.toLowerCase();
  return DB
    .filter(z => (!opts.nurSRD || !z.isHomebrew) &&
      (z.name.toLowerCase().includes(q) || z.nameDe.toLowerCase().includes(q)))
    .slice(0, opts.max ?? 30);
}

export function spellNachSlug(slug: string): SpellDBEintrag | undefined {
  return DB.find(z => z.slug === slug);
}

/** Generates a 5esrd.com compact-view URL from an English spell name. */
export function srdUrl(nameEn: string): string {
  const slug = nameEn
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://www.5esrd.com/database/spell/${slug}/compact`;
}

export const SPELL_DB_GROESSE = DB.length;
export const SPELL_DB_SRD = DB.filter(z => !z.isHomebrew).length;
