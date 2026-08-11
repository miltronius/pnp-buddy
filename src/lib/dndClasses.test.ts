import { describe, expect, it } from 'vitest';
import { emptyCharacter } from './dndGame';
import { applyClassToCharacter } from './dndClasses';
import { applySpeciesToCharacter } from './dndSpecies';
import type { DnDCharacter, DnDSpell } from '../types/dnd';

function makeChar(overrides: Partial<DnDCharacter> = {}): DnDCharacter {
  return { ...emptyCharacter(), ...overrides };
}

function spellSlugs(char: DnDCharacter): string[] {
  return char.zauber.map(z => z.slug ?? z.nameEn ?? z.name);
}

// ── Life Domain Cleric ────────────────────────────────────────────────────────

describe('Life Domain Cleric — Zaubergrants', () => {
  it('Stufe 1: Bless + Cure Wounds werden hinzugefügt', () => {
    const char = makeChar({ klasse: 'Kleriker', unterklasse: 'Lebensdomäne', stufe: 1 });
    const result = applyClassToCharacter(char);
    const slugs = spellSlugs(result);
    expect(slugs).toContain('srd_bless');
    expect(slugs).toContain('srd_cure-wounds');
  });

  it('Stufe 1: Domain-Zauber haben herkunft SUBCLASS', () => {
    const char = makeChar({ klasse: 'Kleriker', unterklasse: 'Lebensdomäne', stufe: 1 });
    const result = applyClassToCharacter(char);
    const domain = result.zauber.filter(z => z.slug === 'srd_bless');
    expect(domain).toHaveLength(1);
    expect(domain[0].herkunft).toBe('SUBCLASS');
  });

  it('Stufe 5: alle drei Domänen-Stufen (1+3+5) enthalten', () => {
    const char = makeChar({ klasse: 'Kleriker', unterklasse: 'Lebensdomäne', stufe: 5 });
    const result = applyClassToCharacter(char);
    const slugs = spellSlugs(result);
    // Stufe 1
    expect(slugs).toContain('srd_bless');
    expect(slugs).toContain('srd_cure-wounds');
    // Stufe 3
    expect(slugs).toContain('srd_aid');
    expect(slugs).toContain('srd_lesser-restoration');
    // Stufe 5
    expect(slugs).toContain('srd_beacon-of-hope');
    expect(slugs).toContain('srd_revivify');
    // Stufe 7 noch nicht
    expect(slugs).not.toContain('srd_death-ward');
  });

  it('Re-apply auf Stufe 3 ergänzt neue Domain-Zauber, entfernt Duplikate nicht', () => {
    // Erst Stufe 1 anwenden, dann Stufe 3
    const char1 = makeChar({ klasse: 'Kleriker', unterklasse: 'Lebensdomäne', stufe: 1 });
    const applied1 = applyClassToCharacter(char1);
    const char3 = { ...applied1, stufe: 3 };
    const applied3 = applyClassToCharacter(char3);
    const slugs = spellSlugs(applied3);
    expect(slugs).toContain('srd_bless');
    expect(slugs).toContain('srd_aid');
    // Kein Duplikat
    expect(slugs.filter(s => s === 'srd_bless')).toHaveLength(1);
  });

  it('Nicht-CLASS/SUBCLASS-Zauber bleiben erhalten', () => {
    const userSpell: DnDSpell = {
      id: 'usr1', name: 'Magiepfeil', stufe: 1, schule: 'Beschwörung',
      herkunft: 'FEAT', aktion: 'ACTION', konzentration: false,
      description: '', komponenten: 'V, S', reichweite: '18m',
    };
    const char = makeChar({ klasse: 'Kleriker', unterklasse: 'Lebensdomäne', stufe: 1, zauber: [userSpell] });
    const result = applyClassToCharacter(char);
    expect(result.zauber.find(z => z.id === 'usr1')).toBeDefined();
  });
});

// ── Sorcerer (no zauberGrants) ────────────────────────────────────────────────

describe('Sorcerer (Zauberer) — keine automatischen Grants', () => {
  it('Stufe 4 Drachenvolk-Zauberer: keine Zauber werden automatisch hinzugefügt', () => {
    const char = makeChar({ rasse: 'Drachenvolk', klasse: 'Zauberer', stufe: 4 });
    const result = applyClassToCharacter(char);
    expect(result.zauber).toHaveLength(0);
  });

  it('Manuell hinzugefügte CLASS-Zauber bleiben beim Re-apply erhalten', () => {
    const userSpell: DnDSpell = {
      id: 's1', name: 'Feuerkugel', stufe: 3, schule: 'Beschwörung',
      herkunft: 'CLASS', aktion: 'ACTION', konzentration: false,
      description: '', komponenten: 'V, S, M', reichweite: '45m',
    };
    const char = makeChar({ klasse: 'Zauberer', stufe: 4, zauber: [userSpell] });
    const result = applyClassToCharacter(char);
    expect(result.zauber.find(z => z.id === 's1')).toBeDefined();
  });

  it('Zauberschlitze werden korrekt für Stufe 4 gesetzt', () => {
    const char = makeChar({ klasse: 'Zauberer', stufe: 4 });
    const result = applyClassToCharacter(char);
    expect(result.zauberschlitze[1]?.max).toBe(4);
    expect(result.zauberschlitze[2]?.max).toBe(3);
    expect(result.zauberschlitze[3]).toBeUndefined();
  });
});

// ── Dragonborn species features ───────────────────────────────────────────────

describe('Drachenvolk — Spezies-Merkmale', () => {
  it('Klasse anwenden fügt Atemwaffe als Merkmal hinzu', () => {
    const char = makeChar({ rasse: 'Drachenvolk', klasse: 'Zauberer', stufe: 4 });
    const result = applySpeciesToCharacter(applyClassToCharacter(char));
    const namen = result.merkmale.map(m => m.nameEn ?? m.name);
    expect(namen).toContain('Breath Weapon');
  });

  it('Stufe 1: alle vier Basis-Merkmale vorhanden', () => {
    const char = makeChar({ rasse: 'Drachenvolk', klasse: 'Barbar', stufe: 1 });
    const result = applySpeciesToCharacter(applyClassToCharacter(char));
    const namen = result.merkmale.map(m => m.nameEn ?? m.name);
    expect(namen).toContain('Draconic Ancestry');
    expect(namen).toContain('Breath Weapon');
    expect(namen).toContain('Draconic Resistance');
    expect(namen).toContain('Darkvision');
    expect(namen).not.toContain('Draconic Flight'); // erst Stufe 5
  });

  it('Stufe 5: Drakonischer Flug wird freigeschaltet', () => {
    const char = makeChar({ rasse: 'Drachenvolk', klasse: 'Barbar', stufe: 5 });
    const result = applySpeciesToCharacter(applyClassToCharacter(char));
    const namen = result.merkmale.map(m => m.nameEn ?? m.name);
    expect(namen).toContain('Draconic Flight');
  });

  it('Re-apply erzeugt keine doppelten SPECIES-Merkmale', () => {
    const char = makeChar({ rasse: 'Drachenvolk', klasse: 'Zauberer', stufe: 3 });
    const once = applySpeciesToCharacter(applyClassToCharacter(char));
    const twice = applySpeciesToCharacter(applyClassToCharacter(once));
    const atemwaffe = twice.merkmale.filter(m => (m.nameEn ?? m.name) === 'Breath Weapon');
    expect(atemwaffe).toHaveLength(1);
  });
});

// ── Archfey Warlock ───────────────────────────────────────────────────────────

describe('Archfey Warlock (Hexenmeister + Erzfey)', () => {
  it('Stufe 1: Calm Emotions + Faerie Fire werden hinzugefügt', () => {
    const char = makeChar({ klasse: 'Hexenmeister', unterklasse: 'Erzfey', stufe: 1 });
    const result = applyClassToCharacter(char);
    const slugs = spellSlugs(result);
    expect(slugs).toContain('srd_calm-emotions');
    expect(slugs).toContain('srd_faerie-fire');
  });

  it('Stufe 3: Misty Step + Phantasmal Force zusätzlich', () => {
    const char = makeChar({ klasse: 'Hexenmeister', unterklasse: 'Erzfey', stufe: 3 });
    const result = applyClassToCharacter(char);
    const slugs = spellSlugs(result);
    expect(slugs).toContain('srd_misty-step');
    expect(slugs).toContain('srd-2024_phantasmal-force');
    expect(slugs).not.toContain('srd_blink'); // lvl 5-Zauber noch nicht
  });
});
