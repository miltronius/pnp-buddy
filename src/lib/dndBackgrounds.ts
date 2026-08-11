export interface BackgroundOption {
  label: string;
  sublabel?: string;
  icon?: string;
}

interface BackgroundDef {
  name: string;
  nameEn: string;
  icon: string;
}

const BACKGROUNDS: BackgroundDef[] = [
  { name: 'Akoluth',      nameEn: 'Acolyte',     icon: '🙏' },
  { name: 'Adliger',      nameEn: 'Noble',        icon: '👑' },
  { name: 'Bauer',        nameEn: 'Farmer',       icon: '🌾' },
  { name: 'Einsiedler',   nameEn: 'Hermit',       icon: '🏕️' },
  { name: 'Gelehrter',    nameEn: 'Sage',         icon: '📜' },
  { name: 'Handwerker',   nameEn: 'Artisan',      icon: '🔨' },
  { name: 'Händler',      nameEn: 'Merchant',     icon: '💰' },
  { name: 'Krimineller',  nameEn: 'Criminal',     icon: '🔓' },
  { name: 'Kundschafter', nameEn: 'Guide',        icon: '🗺️' },
  { name: 'Pilger',       nameEn: 'Pilgrim',      icon: '🚶' },
  { name: 'Scharlatan',   nameEn: 'Charlatan',    icon: '🃏' },
  { name: 'Schreiber',    nameEn: 'Scribe',       icon: '✍️' },
  { name: 'Seefahrer',    nameEn: 'Sailor',       icon: '⚓' },
  { name: 'Soldat',       nameEn: 'Soldier',      icon: '🪖' },
  { name: 'Unterhalter',  nameEn: 'Entertainer',  icon: '🎭' },
  { name: 'Wanderer',     nameEn: 'Wayfarer',     icon: '🎒' },
  { name: 'Wächter',      nameEn: 'Guard',        icon: '🛡️' },
];

export function allBackgroundNames(lang?: string): BackgroundOption[] {
  const opts = lang === 'en'
    ? BACKGROUNDS.map(b => ({ label: b.nameEn, icon: b.icon }))
    : BACKGROUNDS.map(b => ({ label: b.name, sublabel: b.nameEn, icon: b.icon }));
  return opts.sort((a, b) => a.label.localeCompare(b.label, lang === 'en' ? 'en' : 'de'));
}
