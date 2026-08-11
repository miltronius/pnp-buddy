import { useState } from "react";
import type { ActionType, DnDCharacter, DnDResource, DnDSpell as DnDSpellType, OriginType } from "../../types/dnd";
import { SOURCE_COLOR } from "../../lib/dndGame";
import { type SpellDBEintrag, SPELL_DB_GROESSE, SPELL_DB_SRD, spellSuche, srdUrl } from "../../lib/dndSpellDB";
import { useT, useGameLabels, useLang } from "../../i18n";

const SLOT_STUFEN = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const ALLE_HERKUENFTE: OriginType[] = ['SPECIES', 'CLASS', 'SUBCLASS', 'FEAT', 'BACKGROUND'];
const ALLE_AKTIONEN: ActionType[] = ['ACTION', 'BONUS', 'REACTION', 'FREE', 'NONE'];
const GESPERRTE_HERKUENFTE: OriginType[] = ['SPECIES', 'CLASS', 'SUBCLASS'];

function isLockedOrigin(h: OriginType): boolean {
  return GESPERRTE_HERKUENFTE.includes(h);
}

const LS_ZEIGE_HOMEBREW = "gla:dnd:zeigeHomebrew";

function readBool(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key);
  return v === null ? def : v === "true";
}

const LEER_ZAUBER: Omit<DnDSpellType, 'id'> = {
  name: '', level: 0, school: '', origin: 'CLASS',
  action: 'ACTION', concentration: false, description: '', components: 'V, S', range: '',
};

const LEER_RESSOURCE: Omit<DnDResource, 'id'> = {
  name: '', max: 1, current: 1, recharge: 'LONG_REST',
};

interface Props {
  char: DnDCharacter;
  useSlot: (stufe: number) => void;
  refillSlot: (stufe: number) => void;
  setSlotMax: (stufe: number, max: number) => void;
  longRest: () => void;
  shortRest: () => void;
  setConcentration: (id: string | null) => void;
  addSpell: (z: Omit<DnDSpellType, 'id'>) => void;
  updateSpell: (z: DnDSpellType) => void;
  removeSpell: (id: string) => void;
  useResource: (id: string) => void;
  refillResource: (id: string) => void;
  addResource: (r: Omit<DnDResource, 'id'>) => void;
  removeResource: (id: string) => void;
}

export function DnDSpells({
  char, useSlot, refillSlot, setSlotMax, longRest, shortRest,
  setConcentration, addSpell, updateSpell, removeSpell,
  useResource, refillResource, addResource, removeResource,
}: Props) {
  const t = useT();
  const { SOURCE_LABEL, ACTION_LABEL } = useGameLabels();
  const { lang } = useLang();
  const zeigeDe = lang === 'de';

  const [zauberForm, setZauberForm] = useState(false);
  const [bearbeitenId, setBearbeitenId] = useState<string | null>(null);
  const [formDaten, setFormDaten] = useState<Omit<DnDSpellType, 'id'>>(LEER_ZAUBER);
  const [filterStufe, setFilterStufe] = useState<number | 'all'>('all');
  const [konfigMode, setKonfigMode] = useState(false);
  const [resForm, setResForm] = useState(false);
  const [resDaten, setResDaten] = useState<Omit<DnDResource, 'id'>>(LEER_RESSOURCE);
  const [aufgeklappt, setAufgeklappt] = useState<Set<string>>(new Set());

  const [dbSuche, setDbSuche] = useState('');
  const [dbErgebnisse, setDbErgebnisse] = useState<SpellDBEintrag[]>([]);
  const [zeigeHomebrew, setZeigeHomebrew] = useState(() => readBool(LS_ZEIGE_HOMEBREW, false));

  const konzZauber = char.concentration
    ? char.spells.find(z => z.id === char.concentration)
    : null;

  const aktiveSlots = SLOT_STUFEN.filter(s => char.spellSlots[s]?.max > 0);

  const sichtbareZauber = char.spells
    .filter(z => filterStufe === 'all' || z.level === filterStufe)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  function toggleZeigeHomebrew() {
    setZeigeHomebrew(h => {
      const next = !h;
      localStorage.setItem(LS_ZEIGE_HOMEBREW, String(next));
      setDbErgebnisse(spellSuche(dbSuche, {
        nurSRD: !next,
        stufe: filterStufe === 'all' ? undefined : filterStufe,
      }));
      return next;
    });
  }

  function dbRefresh(suche: string, stufe: number | 'all') {
    setDbErgebnisse(spellSuche(suche, {
      nurSRD: !zeigeHomebrew,
      stufe: stufe === 'all' ? undefined : stufe,
    }));
  }

  function sucheAktualisieren(wert: string) {
    setDbSuche(wert);
    dbRefresh(wert, filterStufe);
  }

  function filterStufeSetzen(stufe: number | 'all') {
    setFilterStufe(stufe);
    dbRefresh(dbSuche, stufe);
  }

  function oeffneNeuZauber() {
    setBearbeitenId(null); setFormDaten(LEER_ZAUBER); setZauberForm(true);
  }

  function oeffneBearbeiten(z: DnDSpellType) {
    setBearbeitenId(z.id);
    setFormDaten({
      name: z.name, nameEn: z.nameEn, level: z.level, school: z.school, origin: z.origin,
      action: z.action, concentration: z.concentration, description: z.description,
      components: z.components, range: z.range,
      isHomebrew: z.isHomebrew, slug: z.slug,
    });
    setZauberForm(true);
  }

  function speichernZauber() {
    if (!formDaten.name.trim()) return;
    bearbeitenId ? updateSpell({ ...formDaten, id: bearbeitenId }) : addSpell(formDaten);
    setZauberForm(false); setFormDaten(LEER_ZAUBER); setBearbeitenId(null);
  }

  function speichernRes() {
    if (!resDaten.name.trim() || resDaten.max < 1) return;
    addResource({ ...resDaten, current: resDaten.max });
    setResForm(false); setResDaten(LEER_RESSOURCE);
  }

  function toggleAufgeklappt(id: string) {
    setAufgeklappt(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function importiereAusDB(z: SpellDBEintrag) {
    setFormDaten({
      name: zeigeDe ? z.nameDe : z.name,
      nameEn: z.name, level: z.stufe, school: z.schule, origin: 'CLASS',
      action: z.aktion as ActionType, concentration: z.konzentration,
      description: z.beschreibung, components: z.komponenten, range: z.reichweite,
      isHomebrew: z.isHomebrew, slug: z.slug,
    });
    setBearbeitenId(null); setZauberForm(true); setDbSuche(''); setDbErgebnisse([]);
  }

  return (
    <div className="sheet" style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Konzentrations-Banner */}
      {konzZauber && (
        <div className="dnd-konz-banner">
          {t.dnd_concentration}: <strong>{konzZauber.name}</strong>
          <button className="dnd-icon-btn" style={{ marginLeft: 10 }}
            onClick={() => setConcentration(null)}>{t.dnd_concentration_drop}</button>
        </div>
      )}

      {/* Spell Slots */}
      <div className="dnd-section-header">
        <h2 className="sheet-title" style={{ margin: 0 }}>{t.spell_slots_title}</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="dnd-rast-btn long" onClick={longRest}>{t.spell_slots_long_rest}</button>
          <button className="dnd-rast-btn short" onClick={shortRest}>{t.spell_slots_short_rest}</button>
          <button className="dnd-icon-btn" title={t.spell_slots_configure}
            onClick={() => setKonfigMode(m => !m)}>⚙</button>
        </div>
      </div>

      {konfigMode && (
        <div className="dnd-slot-konfig">
          {SLOT_STUFEN.map(s => (
            <label key={s} className="dnd-slot-konfig-zeile">
              <span>{t.spell_slots_rank} {s}</span>
              <input type="number" min={0} max={9} className="dnd-slot-max-input"
                value={char.spellSlots[s]?.max ?? 0}
                onChange={e => setSlotMax(s, parseInt(e.target.value) || 0)} />
            </label>
          ))}
        </div>
      )}

      {aktiveSlots.length === 0 && !konfigMode ? (
        <p className="dnd-leer-hinweis">{t.spell_slots_none}</p>
      ) : (
        <div className="dnd-slot-bereich">
          {aktiveSlots.map(s => {
            const slot = char.spellSlots[s];
            return (
              <div key={s} className="dnd-slot-reihe">
                <span className="dnd-slot-label">{t.spell_slots_rank} {s}</span>
                <div className="dnd-slot-pips">
                  {Array.from({ length: slot.max }).map((_, i) => {
                    const voll = i < slot.current;
                    return (
                      <button key={i}
                        className={`dnd-slot-pip ${voll ? 'voll' : 'leer'}`}
                        onClick={() => voll ? useSlot(s) : refillSlot(s)}
                        title={voll ? t.spell_slots_use : t.spell_slots_refill} />
                    );
                  })}
                </div>
                <span className="dnd-slot-count">{slot.current}/{slot.max}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Ressourcen */}
      <div className="rule" />
      <div className="dnd-section-header">
        <div className="field-label" style={{ marginBottom: 0 }}>{t.resources_title}</div>
        <button className="gla-btn" style={{ fontSize: 13, padding: '4px 12px' }}
          onClick={() => setResForm(r => !r)}>{t.resources_add}</button>
      </div>

      {resForm && (
        <div className="dnd-form-box" style={{ marginTop: 8 }}>
          <div className="grid-2">
            <div>
              <div className="field-label">{t.name}</div>
              <input className="gla-input" value={resDaten.name} autoFocus
                onChange={e => setResDaten(r => ({ ...r, name: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">{t.resources_maximum}</div>
              <input className="gla-input" type="number" min={1} max={99}
                value={resDaten.max}
                onChange={e => setResDaten(r => ({ ...r, max: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <div className="field-label">{t.resources_recharge}</div>
              <select className="gla-input" value={resDaten.recharge}
                onChange={e => setResDaten(r => ({ ...r, recharge: e.target.value as DnDResource['recharge'] }))}>
                <option value="LONG_REST">{t.resources_long_rest}</option>
                <option value="SHORT_REST">{t.resources_short_rest}</option>
                <option value="AT_WILL">{t.resources_at_will}</option>
              </select>
            </div>
          </div>
          <div className="dnd-form-actions">
            <button className="gla-btn primary" onClick={speichernRes}>{t.add}</button>
            <button className="gla-btn" onClick={() => setResForm(false)}>{t.cancel}</button>
          </div>
        </div>
      )}

      {char.resources.length === 0 && !resForm && (
        <p className="dnd-leer-hinweis">{t.resources_none}</p>
      )}

      <div className="dnd-ressourcen-liste">
        {char.resources.map(r => {
          const aufladungLabel = r.recharge === 'LONG_REST' ? 'L' : r.recharge === 'SHORT_REST' ? 'K' : '∞';
          return (
            <div key={r.id} className="dnd-ressource-row">
              <span className="dnd-ressource-name">{r.name}</span>
              <div className="dnd-slot-pips">
                {Array.from({ length: r.max }).map((_, i) => {
                  const voll = i < r.current;
                  return (
                    <button key={i}
                      className={`dnd-slot-pip ${voll ? 'voll ressource' : 'leer'}`}
                      onClick={() => voll ? useResource(r.id) : refillResource(r.id)}
                      title={voll ? t.spell_slots_use : t.spell_slots_refill} />
                  );
                })}
              </div>
              <span className="dnd-slot-count">{r.current}/{r.max}</span>
              <span className="dnd-res-aufladung" title={
                r.recharge === 'LONG_REST' ? t.resources_long_rest
                : r.recharge === 'SHORT_REST' ? t.resources_short_rest : t.resources_at_will
              }>{aufladungLabel}</span>
              <button className="dnd-icon-btn danger" onClick={() => removeResource(r.id)}>✕</button>
            </div>
          );
        })}
      </div>

      <div className="rule" />

      {/* Zauberliste */}
      <div className="dnd-section-header">
        <h2 className="sheet-title" style={{ margin: 0, fontSize: 22 }}>
          {t.spells_known}
          <span className="dnd-db-info"> ({SPELL_DB_SRD} SRD{zeigeHomebrew ? ` + ${SPELL_DB_GROESSE - SPELL_DB_SRD} HB` : ''} in DB)</span>
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="gla-btn" onClick={oeffneNeuZauber}>{t.spells_add_manual}</button>
        </div>
      </div>

      {/* Datenbank-Suche */}
      <div className="dnd-db-suche">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="gla-input dnd-db-input"
            placeholder={t.spells_search_placeholder}
            value={dbSuche}
            onChange={e => sucheAktualisieren(e.target.value)}
          />
          <button
            className={`dnd-filter-btn ${zeigeHomebrew ? 'active' : ''}`}
            onClick={toggleZeigeHomebrew}
            title={t.spells_hb_title}
          >HB</button>
        </div>
        {dbErgebnisse.length > 0 && (
          <div className="dnd-db-ergebnisse">
            {dbErgebnisse.map(z => (
              <button key={z.slug} className="dnd-db-treffer" onClick={() => importiereAusDB(z)}>
                <span className="dnd-db-treffer-name">
                  {zeigeDe ? z.nameDe : z.name}
                  {zeigeDe && z.nameDe !== z.name && (
                    <span className="dnd-db-treffer-en"> ({z.name})</span>
                  )}
                  {z.isHomebrew && <span className="dnd-homebrew-badge">HB</span>}
                </span>
                <span className="dnd-db-treffer-meta">
                  {z.stufe === 0 ? t.spells_cantrip : `${t.spells_rank} ${z.stufe}`} · {z.schule}
                </span>
              </button>
            ))}
          </div>
        )}
        {dbSuche && dbErgebnisse.length === 0 && (
          <div className="dnd-leer-hinweis" style={{ padding: '6px 0', textAlign: 'left' }}>
            {t.spells_no_results}
          </div>
        )}
      </div>

      {/* Stufen-Filter */}
      <div className="dnd-filter-leiste">
        <button className={`dnd-filter-btn ${filterStufe === 'all' ? 'active' : ''}`}
          onClick={() => filterStufeSetzen('all')}>{t.all}</button>
        <button className={`dnd-filter-btn ${filterStufe === 0 ? 'active' : ''}`}
          onClick={() => filterStufeSetzen(filterStufe === 0 ? 'all' : 0)}>{t.spells_cantrip}</button>
        {SLOT_STUFEN.map(s => (
          <button key={s}
            className={`dnd-filter-btn ${filterStufe === s ? 'active' : ''}`}
            onClick={() => filterStufeSetzen(filterStufe === s ? 'all' : s)}>{t.spells_rank} {s}</button>
        ))}
      </div>

      {/* Zauber-Formular */}
      {zauberForm && (
        <div className="dnd-form-box">
          <div className="dnd-zauber-form-grid">
            <div>
              <div className="field-label">{t.name}</div>
              <input className="gla-input" value={formDaten.name} autoFocus
                onChange={e => setFormDaten(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">{t.spells_rank_label}</div>
              <input className="gla-input" type="number" min={0} max={9}
                value={formDaten.level}
                onChange={e => setFormDaten(f => ({ ...f, level: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <div className="field-label">{t.spells_school}</div>
              <input className="gla-input" value={formDaten.school}
                onChange={e => setFormDaten(f => ({ ...f, school: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">{t.origin}</div>
              <select className="gla-input" value={formDaten.origin}
                disabled={bearbeitenId ? isLockedOrigin(char.spells.find(z => z.id === bearbeitenId)?.origin ?? 'FEAT') : false}
                onChange={e => setFormDaten(f => ({ ...f, origin: e.target.value as OriginType }))}>
                {ALLE_HERKUENFTE.map(h => (
                  <option key={h} value={h}>{SOURCE_LABEL[h]}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="field-label">{t.action_action}</div>
              <select className="gla-input" value={formDaten.action}
                onChange={e => setFormDaten(f => ({ ...f, action: e.target.value as ActionType }))}>
                {ALLE_AKTIONEN.map(a => (
                  <option key={a} value={a}>{ACTION_LABEL[a]}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="field-label">{t.spells_components}</div>
              <input className="gla-input" value={formDaten.components}
                onChange={e => setFormDaten(f => ({ ...f, components: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">{t.spells_range}</div>
              <input className="gla-input" value={formDaten.range}
                onChange={e => setFormDaten(f => ({ ...f, range: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
              <label className="dnd-checkbox-label">
                <input type="checkbox" checked={formDaten.concentration}
                  onChange={e => setFormDaten(f => ({ ...f, concentration: e.target.checked }))} />
                {t.spells_concentration}
              </label>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="field-label">{t.description}</div>
            <textarea className="gla-textarea" value={formDaten.description} rows={3}
              onChange={e => setFormDaten(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="dnd-form-actions">
            <button className="gla-btn primary" onClick={speichernZauber}>{t.save}</button>
            <button className="gla-btn" onClick={() => { setZauberForm(false); setFormDaten(LEER_ZAUBER); setBearbeitenId(null); }}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {sichtbareZauber.length === 0 && (
        <p className="dnd-leer-hinweis">{t.spells_none}</p>
      )}

      <div className="dnd-zauber-liste">
        {sichtbareZauber.map(z => {
          const istKonz = char.concentration === z.id;
          const offen = aufgeklappt.has(z.id);
          const nameEn = z.nameEn ?? z.slug ?? null;
          const srdLink = (!z.isHomebrew && nameEn) ? srdUrl(nameEn) : null;
          return (
            <div key={z.id} className={`dnd-zauber-item ${istKonz ? 'konzentriert' : ''}`}>
              <div className="dnd-zauber-header">
                <div className="dnd-zauber-info">
                  <span className="dnd-herkunft-badge" style={{ background: SOURCE_COLOR[z.origin] }}>
                    {SOURCE_LABEL[z.origin]}
                  </span>
                  {z.isHomebrew && <span className="dnd-homebrew-badge">HB</span>}
                  {z.concentration && (
                    <button
                      className={`dnd-konz-tag ${istKonz ? 'aktiv' : ''}`}
                      onClick={() => setConcentration(istKonz ? null : z.id)}
                      title={istKonz ? t.dnd_concentration_drop : t.spells_concentration}>
                      🧿
                    </button>
                  )}
                  <button className="dnd-zauber-name-btn" onClick={() => toggleAufgeklappt(z.id)}>
                    <strong>{z.name}</strong>
                    {z.nameEn && z.nameEn !== z.name && (
                      <span className="dnd-db-treffer-en"> ({z.nameEn})</span>
                    )}
                    <span className="dnd-zauber-meta-inline">
                      {z.level === 0 ? t.spells_cantrip : `${t.spells_rank} ${z.level}`}
                      {z.school && ` · ${z.school}`}
                      {` · ${ACTION_LABEL[z.action]}`}
                    </span>
                    {(z.description || z.components || z.range) &&
                      <span className="dnd-merkmal-pfeil">{offen ? '▲' : '▼'}</span>}
                  </button>
                </div>
                <div className="dnd-merkmal-aktionen">
                  {srdLink && (
                    <a className="dnd-srd-link" href={srdLink} target="_blank" rel="noopener noreferrer"
                      title={t.spells_srd_title} onClick={e => e.stopPropagation()}>SRD</a>
                  )}
                  <button className="dnd-icon-btn" onClick={() => oeffneBearbeiten(z)}>✎</button>
                  {!isLockedOrigin(z.origin) && (
                    <button className="dnd-icon-btn danger" onClick={() => removeSpell(z.id)}>✕</button>
                  )}
                </div>
              </div>
              {offen && (
                <div className="dnd-merkmal-text">
                  {(z.components || z.range) && (
                    <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 4 }}>
                      {z.components && <span>{t.spells_components_label} {z.components}</span>}
                      {z.components && z.range && ' · '}
                      {z.range && <span>{t.spells_range_label} {z.range}</span>}
                    </div>
                  )}
                  {z.description && <div>{z.description}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
