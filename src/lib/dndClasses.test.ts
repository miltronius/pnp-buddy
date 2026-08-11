import { describe, expect, it } from 'vitest';
import { emptyCharacter } from './dndGame';
import { applyClassToCharacter } from './dndClasses';
import { applySpeciesToCharacter } from './dndSpecies';
import type { DnDCharacter, DnDSpell } from '../types/dnd';

function makeChar(overrides: Partial<DnDCharacter> = {}): DnDCharacter {
  return { ...emptyCharacter(), ...overrides };
}

function spellSlugs(char: DnDCharacter): string[] {
  return char.spells.map(z => z.slug ?? z.nameEn ?? z.name);
}

// ── Life Domain Cleric ────────────────────────────────────────────────────────

describe('Life Domain Cleric — Zaubergrants', () => {
  it('Stufe 1: Bless + Cure Wounds werden hinzugefügt', () => {
    const char = makeChar({ charClass: 'Kleriker', subclass: 'Lebensdomäne', level: 1 });
    const result = applyClassToCharacter(char);
    const slugs = spellSlugs(result);
    expect(slugs).toContain('srd_bless');
    expect(slugs).toContain('srd_cure-wounds');
  });

  it('Stufe 1: Domain-Zauber haben origin SUBCLASS', () => {
    const char = makeChar({ charClass: 'Kleriker', subclass: 'Lebensdomäne', level: 1 });
    const result = applyClassToCharacter(char);
    const domain = result.spells.filter(z => z.slug === 'srd_bless');
    expect(domain).toHaveLength(1);
    expect(domain[0].origin).toBe('SUBCLASS');
  });

  it('Stufe 5: alle drei Domänen-Stufen (1+3+5) enthalten', () => {
    const char = makeChar({ charClass: 'Kleriker', subclass: 'Lebensdomäne', level: 5 });
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
    const char1 = makeChar({ charClass: 'Kleriker', subclass: 'Lebensdomäne', level: 1 });
    const applied1 = applyClassToCharacter(char1);
    const char3 = { ...applied1, level: 3 };
    const applied3 = applyClassToCharacter(char3);
    const slugs = spellSlugs(applied3);
    expect(slugs).toContain('srd_bless');
    expect(slugs).toContain('srd_aid');
    // Kein Duplikat
    expect(slugs.filter(s => s === 'srd_bless')).toHaveLength(1);
  });

  it('Nicht-CLASS/SUBCLASS-Zauber bleiben erhalten', () => {
    const userSpell: DnDSpell = {
      id: 'usr1', name: 'Magiepfeil', level: 1, school: 'Beschwörung',
      origin: 'FEAT', action: 'ACTION', concentration: false,
      description: '', components: 'V, S', range: '18m',
    };
    const char = makeChar({ charClass: 'Kleriker', subclass: 'Lebensdomäne', level: 1, spells: [userSpell] });
    const result = applyClassToCharacter(char);
    expect(result.spells.find(z => z.id === 'usr1')).toBeDefined();
  });
});

// ── Sorcerer (no zauberGrants) ────────────────────────────────────────────────

describe('Sorcerer (Zauberer) — keine automatischen Grants', () => {
  it('Stufe 4 Drachenvolk-Zauberer: keine Zauber werden automatisch hinzugefügt', () => {
    const char = makeChar({ species: 'Drachenvolk', charClass: 'Zauberer', level: 4 });
    const result = applyClassToCharacter(char);
    expect(result.spells).toHaveLength(0);
  });

  it('Manuell hinzugefügte CLASS-Zauber bleiben beim Re-apply erhalten', () => {
    const userSpell: DnDSpell = {
      id: 's1', name: 'Feuerkugel', level: 3, school: 'Beschwörung',
      origin: 'CLASS', action: 'ACTION', concentration: false,
      description: '', components: 'V, S, M', range: '45m',
    };
    const char = makeChar({ charClass: 'Zauberer', level: 4, spells: [userSpell] });
    const result = applyClassToCharacter(char);
    expect(result.spells.find(z => z.id === 's1')).toBeDefined();
  });

  it('Zauberschlitze werden korrekt für Stufe 4 gesetzt', () => {
    const char = makeChar({ charClass: 'Zauberer', level: 4 });
    const result = applyClassToCharacter(char);
    expect(result.spellSlots[1]?.max).toBe(4);
    expect(result.spellSlots[2]?.max).toBe(3);
    expect(result.spellSlots[3]).toBeUndefined();
  });
});

// ── Dragonborn species features ───────────────────────────────────────────────

describe('Drachenvolk — Spezies-Merkmale', () => {
  it('Klasse anwenden fügt Atemwaffe als Merkmal hinzu', () => {
    const char = makeChar({ species: 'Drachenvolk', charClass: 'Zauberer', level: 4 });
    const result = applySpeciesToCharacter(applyClassToCharacter(char));
    const namen = result.features.map(m => m.nameEn ?? m.name);
    expect(namen).toContain('Breath Weapon');
  });

  it('Stufe 1: alle vier Basis-Merkmale vorhanden', () => {
    const char = makeChar({ species: 'Drachenvolk', charClass: 'Barbar', level: 1 });
    const result = applySpeciesToCharacter(applyClassToCharacter(char));
    const namen = result.features.map(m => m.nameEn ?? m.name);
    expect(namen).toContain('Draconic Ancestry');
    expect(namen).toContain('Breath Weapon');
    expect(namen).toContain('Draconic Resistance');
    expect(namen).toContain('Darkvision');
    expect(namen).not.toContain('Draconic Flight'); // erst Stufe 5
  });

  it('Stufe 5: Drakonischer Flug wird freigeschaltet', () => {
    const char = makeChar({ species: 'Drachenvolk', charClass: 'Barbar', level: 5 });
    const result = applySpeciesToCharacter(applyClassToCharacter(char));
    const namen = result.features.map(m => m.nameEn ?? m.name);
    expect(namen).toContain('Draconic Flight');
  });

  it('Re-apply erzeugt keine doppelten SPECIES-Merkmale', () => {
    const char = makeChar({ species: 'Drachenvolk', charClass: 'Zauberer', level: 3 });
    const once = applySpeciesToCharacter(applyClassToCharacter(char));
    const twice = applySpeciesToCharacter(applyClassToCharacter(once));
    const atemwaffe = twice.features.filter(m => (m.nameEn ?? m.name) === 'Breath Weapon');
    expect(atemwaffe).toHaveLength(1);
  });
});

// ── Archfey Warlock ───────────────────────────────────────────────────────────

describe('Archfey Warlock (Hexenmeister + Erzfey)', () => {
  it('Stufe 1: Calm Emotions + Faerie Fire werden hinzugefügt', () => {
    const char = makeChar({ charClass: 'Hexenmeister', subclass: 'Erzfey', level: 1 });
    const result = applyClassToCharacter(char);
    const slugs = spellSlugs(result);
    expect(slugs).toContain('srd_calm-emotions');
    expect(slugs).toContain('srd_faerie-fire');
  });

  it('Stufe 3: Misty Step + Phantasmal Force zusätzlich', () => {
    const char = makeChar({ charClass: 'Hexenmeister', subclass: 'Erzfey', level: 3 });
    const result = applyClassToCharacter(char);
    const slugs = spellSlugs(result);
    expect(slugs).toContain('srd_misty-step');
    expect(slugs).toContain('srd-2024_phantasmal-force');
    expect(slugs).not.toContain('srd_blink'); // lvl 5-Zauber noch nicht
  });
});
