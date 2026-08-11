import { useState } from "react";
import type { DnDCharacter, ActionType } from "../../types/dnd";
import { useLang } from "../../i18n";

interface Props {
  char: DnDCharacter;
}

interface TurnState {
  aktionGenutzt: boolean;
  bonusGenutzt: boolean;
  reaktionGenutzt: boolean;
  bewegungGenutzt: number;
}

const EMPTY_TURN: TurnState = {
  aktionGenutzt: false,
  bonusGenutzt: false,
  reaktionGenutzt: false,
  bewegungGenutzt: 0,
};

interface RefEntry {
  icon: string;
  titleDe: string;
  titleEn: string;
  descDe: string;
  descEn: string;
  usesDe: string;
  usesEn: string;
  actionType: ActionType | null;
}

const REF_ENTRIES: RefEntry[] = [
  {
    icon: '⚔',
    titleDe: 'Aktion', titleEn: 'Action',
    descDe: 'Die Hauptaktion deines Zuges.',
    descEn: 'The main action of your turn.',
    usesDe: 'Angriff · Zaubern · Rennen (extra Bewegung) · Helfen · Ausweichen · Verstecken · Bereit machen · Suchen · Einsetzen',
    usesEn: 'Attack · Cast a spell · Dash (extra movement) · Help · Dodge · Hide · Ready · Search · Use an Object',
    actionType: 'ACTION',
  },
  {
    icon: '⚡',
    titleDe: 'Bonusaktion', titleEn: 'Bonus Action',
    descDe: 'Nur wenn ein Merkmal oder Zauber es explizit erlaubt — nicht jeder hat automatisch eine.',
    descEn: 'Only when a feature or spell explicitly grants one — not everyone always has one.',
    usesDe: 'Two-Weapon-Angriff · Cunning Action (Schurke) · Barbar-Raserei · Geisterfaust-Angriff · bestimmte Bonus-Zauber',
    usesEn: 'Two-Weapon Fighting attack · Cunning Action (Rogue) · Barbarian Rage · Spiritual Weapon attack · certain bonus-action spells',
    actionType: 'BONUS',
  },
  {
    icon: '🛡',
    titleDe: 'Reaktion', titleEn: 'Reaction',
    descDe: 'Einmal pro Runde, auch wenn du nicht dran bist. Erneuert sich zu Beginn deines nächsten Zuges.',
    descEn: 'Once per round, even when it\'s not your turn. Recharges at the start of your next turn.',
    usesDe: 'Gelegenheitsangriff · Schild (Zauber) · Konter-Zauber · Heilige Waffe · viele Klassen-Merkmale',
    usesEn: 'Opportunity Attack · Shield (spell) · Counterspell · Divine Smite (reaction) · many class features',
    actionType: 'REACTION',
  },
  {
    icon: '💬',
    titleDe: 'Freie Aktion', titleEn: 'Free Action',
    descDe: 'Keine Aktionskosten — nach SL-Ermessen, meist 1× pro Zug kostenlos.',
    descEn: 'No action cost — DM\'s discretion, usually 1× free per turn.',
    usesDe: 'Kurz sprechen · Gegenstand fallen lassen · Mit 1 Objekt interagieren (z.B. Tür öffnen)',
    usesEn: 'Speak briefly · Drop an item · Interact with 1 object (e.g. open a door)',
    actionType: 'FREE',
  },
  {
    icon: '🚶',
    titleDe: 'Bewegung', titleEn: 'Movement',
    descDe: 'Frei aufteilen — auch zwischen einzelnen Angriffen. Kein Minimum.',
    descEn: 'Split freely — even between individual attacks. No minimum.',
    usesDe: 'Schwieriges Gelände ×½ · Aufstehen = ½ Bewegung · Klettern / Schwimmen = ×2 Kosten (außer bei entsprechender Fähigkeit)',
    usesEn: 'Difficult terrain ×½ · Stand up = ½ movement · Climbing / Swimming = ×2 cost (unless you have a relevant ability)',
    actionType: null,
  },
];

export function DnDCombatRound({ char }: Props) {
  const { lang } = useLang();
  const isDe = lang === 'de';

  const [runde, setRunde] = useState(1);
  const [turn, setTurn] = useState<TurnState>(EMPTY_TURN);
  const [openRef, setOpenRef] = useState<number | null>(null);

  const speed = char.geschwindigkeit || 30;

  function naechsteRunde() {
    setTurn(EMPTY_TURN);
    setRunde(r => r + 1);
  }

  function resetKampf() {
    setTurn(EMPTY_TURN);
    setRunde(1);
  }

  function addBewegung(delta: number) {
    setTurn(prev => ({
      ...prev,
      bewegungGenutzt: Math.max(0, Math.min(speed, prev.bewegungGenutzt + delta)),
    }));
  }

  const spellsByAction = (['ACTION', 'BONUS', 'REACTION'] as ActionType[]).map(type => ({
    type,
    spells: char.zauber.filter(z => z.aktion === type),
  })).filter(g => g.spells.length > 0);

  const bewegungPct = speed > 0 ? (turn.bewegungGenutzt / speed) * 100 : 0;

  return (
    <div className="sheet" style={{ padding: '20px 24px 28px' }}>

      {/* ── Runden-Header ─────────────────────────────────────────── */}
      <div className="dnd-runde-header">
        <span className="dnd-runde-nummer">
          ⚔ {isDe ? 'Runde' : 'Round'} {runde}
        </span>
        <div className="dnd-runde-header-btns">
          <button className="dnd-icon-btn" onClick={naechsteRunde}>
            {isDe ? 'Nächste Runde →' : 'Next Round →'}
          </button>
          <button className="dnd-icon-btn" onClick={resetKampf} title={isDe ? 'Kampf zurücksetzen' : 'Reset combat'}>
            ↺
          </button>
        </div>
      </div>

      {/* ── Aktions-Slots ─────────────────────────────────────────── */}
      <div className="dnd-runde-slots">
        {[
          { icon: '⚔', label: isDe ? 'Aktion' : 'Action',       used: turn.aktionGenutzt,  toggle: () => setTurn(p => ({ ...p, aktionGenutzt:  !p.aktionGenutzt  })) },
          { icon: '⚡', label: isDe ? 'Bonusaktion' : 'Bonus',   used: turn.bonusGenutzt,   toggle: () => setTurn(p => ({ ...p, bonusGenutzt:   !p.bonusGenutzt   })) },
          { icon: '🛡', label: isDe ? 'Reaktion' : 'Reaction',   used: turn.reaktionGenutzt,toggle: () => setTurn(p => ({ ...p, reaktionGenutzt:!p.reaktionGenutzt })) },
        ].map(({ icon, label, used, toggle }) => (
          <button
            key={label}
            className={`dnd-runde-slot ${used ? 'genutzt' : ''}`}
            onClick={toggle}
          >
            <span className="dnd-runde-slot-icon">{icon}</span>
            <span className="dnd-runde-slot-label">{label}</span>
            <span className="dnd-runde-slot-status">
              {used ? (isDe ? '✓ genutzt' : '✓ used') : (isDe ? 'verfügbar' : 'available')}
            </span>
          </button>
        ))}
      </div>

      {/* ── Bewegung ──────────────────────────────────────────────── */}
      <div className="dnd-runde-bewegung">
        <div className="dnd-runde-bew-top">
          <span className="dnd-runde-bew-label">
            🚶 {isDe ? 'Bewegung' : 'Movement'}
          </span>
          <span className="dnd-runde-bew-count">
            {turn.bewegungGenutzt} / {speed} ft
          </span>
          <div className="dnd-runde-bew-btns">
            <button className="dnd-icon-btn" onClick={() => addBewegung(5)} disabled={turn.bewegungGenutzt >= speed}>+5</button>
            <button className="dnd-icon-btn" onClick={() => addBewegung(-5)} disabled={turn.bewegungGenutzt <= 0}>−5</button>
            <button className="dnd-icon-btn" onClick={() => setTurn(p => ({ ...p, bewegungGenutzt: 0 }))} title={isDe ? 'Zurücksetzen' : 'Reset'}>↺</button>
          </div>
        </div>
        <div className="dnd-runde-bew-bar-bg">
          <div
            className="dnd-runde-bew-bar-fill"
            style={{ width: `${bewegungPct}%` }}
          />
        </div>
      </div>

      {/* ── Aktionsreferenz ───────────────────────────────────────── */}
      <div className="dnd-section-header" style={{ marginTop: 22 }}>
        {isDe ? 'Was kann ich tun?' : 'What can I do?'}
      </div>

      <div className="dnd-runde-ref-list">
        {REF_ENTRIES.map((entry, i) => {
          const isOpen = openRef === i;
          return (
            <div key={i} className="dnd-runde-ref-item">
              <button
                className="dnd-runde-ref-header"
                onClick={() => setOpenRef(isOpen ? null : i)}
              >
                <span>{entry.icon} {isDe ? entry.titleDe : entry.titleEn}</span>
                <span className="dnd-runde-ref-chevron">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className="dnd-runde-ref-body">
                  <p className="dnd-runde-ref-desc">
                    {isDe ? entry.descDe : entry.descEn}
                  </p>
                  <p className="dnd-runde-ref-uses">
                    {isDe ? entry.usesDe : entry.usesEn}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Deine Zauber nach Aktion ──────────────────────────────── */}
      {spellsByAction.length > 0 && (
        <>
          <div className="dnd-section-header" style={{ marginTop: 22 }}>
            {isDe ? 'Deine Zauber nach Aktion' : 'Your Spells by Action'}
          </div>
          <div className="dnd-runde-zauber-liste">
            {spellsByAction.map(({ type, spells }) => {
              const icon = type === 'ACTION' ? '⚔' : type === 'BONUS' ? '⚡' : '🛡';
              const label = type === 'ACTION'
                ? (isDe ? 'Aktion' : 'Action')
                : type === 'BONUS'
                  ? (isDe ? 'Bonusaktion' : 'Bonus')
                  : (isDe ? 'Reaktion' : 'Reaction');
              return (
                <div key={type} className="dnd-runde-zauber-gruppe">
                  <span className="dnd-runde-zauber-typ">{icon} {label}</span>
                  <div className="dnd-runde-zauber-names">
                    {spells.map(z => (
                      <span key={z.id} className="dnd-runde-zauber-chip">
                        {isDe ? z.name : (z.nameEn ?? z.name)}
                        {z.konzentration && <span className="dnd-runde-konz" title={isDe ? 'Konzentration' : 'Concentration'}>🧿</span>}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
