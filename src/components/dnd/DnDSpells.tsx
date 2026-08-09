import { useState } from "react";
import type { AktionsTyp, DnDCharakter, DnDRessource, DnDZauber as DnDZauberTyp, HerkunftArt } from "../../types/dnd";
import { ACTION_LABEL, SOURCE_COLOR, SOURCE_LABEL } from "../../lib/dndGame";
import { type SpellDBEintrag, SPELL_DB_GROESSE, SPELL_DB_SRD, spellSuche, srdUrl } from "../../lib/dndSpellDB";

const SLOT_STUFEN = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const ALLE_HERKUENFTE: HerkunftArt[] = ['SPECIES', 'CLASS', 'SUBCLASS', 'FEAT', 'BACKGROUND'];
const ALLE_AKTIONEN: AktionsTyp[] = ['ACTION', 'BONUS', 'REACTION', 'FREE', 'NONE'];

const LS_ZEIGE_DE = "gla:dnd:zeigeDe";
const LS_ZEIGE_HOMEBREW = "gla:dnd:zeigeHomebrew";

function readBool(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key);
  return v === null ? def : v === "true";
}

const LEER_ZAUBER: Omit<DnDZauberTyp, 'id'> = {
  name: '', stufe: 0, schule: '', herkunft: 'CLASS',
  aktion: 'ACTION', konzentration: false, beschreibung: '', komponenten: 'V, S', reichweite: '',
};

const LEER_RESSOURCE: Omit<DnDRessource, 'id'> = {
  name: '', max: 1, aktuell: 1, aufladung: 'LONG_REST',
};

interface Props {
  char: DnDCharakter;
  slotNutzen: (stufe: number) => void;
  slotAuffuellen: (stufe: number) => void;
  slotMaxSetzen: (stufe: number, max: number) => void;
  langeRast: () => void;
  kurzeRast: () => void;
  setKonzentration: (id: string | null) => void;
  zauberHinzu: (z: Omit<DnDZauberTyp, 'id'>) => void;
  zauberAktuell: (z: DnDZauberTyp) => void;
  zauberLoeschen: (id: string) => void;
  ressourceNutzen: (id: string) => void;
  ressourceZurueck: (id: string) => void;
  ressourceHinzu: (r: Omit<DnDRessource, 'id'>) => void;
  ressourceLoeschen: (id: string) => void;
}

export function DnDSpells({
  char, slotNutzen, slotAuffuellen, slotMaxSetzen, langeRast, kurzeRast,
  setKonzentration, zauberHinzu, zauberAktuell, zauberLoeschen,
  ressourceNutzen, ressourceZurueck, ressourceHinzu, ressourceLoeschen,
}: Props) {
  const [zauberForm, setZauberForm] = useState(false);
  const [bearbeitenId, setBearbeitenId] = useState<string | null>(null);
  const [formDaten, setFormDaten] = useState<Omit<DnDZauberTyp, 'id'>>(LEER_ZAUBER);
  const [filterStufe, setFilterStufe] = useState<number | 'all'>('all');
  const [konfigMode, setKonfigMode] = useState(false);
  const [resForm, setResForm] = useState(false);
  const [resDaten, setResDaten] = useState<Omit<DnDRessource, 'id'>>(LEER_RESSOURCE);
  const [aufgeklappt, setAufgeklappt] = useState<Set<string>>(new Set());

  // Datenbank-Suche
  const [dbSuche, setDbSuche] = useState('');
  const [dbErgebnisse, setDbErgebnisse] = useState<SpellDBEintrag[]>([]);
  const [zeigeDe, setZeigeDe] = useState(() => readBool(LS_ZEIGE_DE, true));
  const [zeigeHomebrew, setZeigeHomebrew] = useState(() => readBool(LS_ZEIGE_HOMEBREW, false));

  const konzZauber = char.konzentration
    ? char.zauber.find(z => z.id === char.konzentration)
    : null;

  const aktiveSlots = SLOT_STUFEN.filter(s => char.zauberschlitze[s]?.max > 0);

  const sichtbareZauber = char.zauber
    .filter(z => filterStufe === 'all' || z.stufe === filterStufe)
    .sort((a, b) => a.stufe - b.stufe || a.name.localeCompare(b.name));

  function toggleZeigeDe() {
    setZeigeDe(d => {
      localStorage.setItem(LS_ZEIGE_DE, String(!d));
      return !d;
    });
  }

  function toggleZeigeHomebrew() {
    setZeigeHomebrew(h => {
      const next = !h;
      localStorage.setItem(LS_ZEIGE_HOMEBREW, String(next));
      // Refresh search results with new filter
      if (dbSuche) {
        setDbErgebnisse(spellSuche(dbSuche, { nurSRD: !next }));
      }
      return next;
    });
  }

  function sucheAktualisieren(wert: string) {
    setDbSuche(wert);
    setDbErgebnisse(spellSuche(wert, { nurSRD: !zeigeHomebrew }));
  }

  function oeffneNeuZauber() {
    setBearbeitenId(null);
    setFormDaten(LEER_ZAUBER);
    setZauberForm(true);
  }

  function oeffneBearbeiten(z: DnDZauberTyp) {
    setBearbeitenId(z.id);
    setFormDaten({
      name: z.name, nameEn: z.nameEn, stufe: z.stufe, schule: z.schule, herkunft: z.herkunft,
      aktion: z.aktion, konzentration: z.konzentration, beschreibung: z.beschreibung,
      komponenten: z.komponenten, reichweite: z.reichweite,
      isHomebrew: z.isHomebrew, slug: z.slug,
    });
    setZauberForm(true);
  }

  function speichernZauber() {
    if (!formDaten.name.trim()) return;
    bearbeitenId ? zauberAktuell({ ...formDaten, id: bearbeitenId }) : zauberHinzu(formDaten);
    setZauberForm(false);
    setFormDaten(LEER_ZAUBER);
    setBearbeitenId(null);
  }

  function speichernRes() {
    if (!resDaten.name.trim() || resDaten.max < 1) return;
    ressourceHinzu({ ...resDaten, aktuell: resDaten.max });
    setResForm(false);
    setResDaten(LEER_RESSOURCE);
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
      nameEn: z.name,
      stufe: z.stufe,
      schule: z.schule,
      herkunft: 'CLASS',
      aktion: z.aktion as AktionsTyp,
      konzentration: z.konzentration,
      beschreibung: z.beschreibung,
      komponenten: z.komponenten,
      reichweite: z.reichweite,
      isHomebrew: z.isHomebrew,
      slug: z.slug,
    });
    setBearbeitenId(null);
    setZauberForm(true);
    setDbSuche('');
    setDbErgebnisse([]);
  }

  return (
    <div className="sheet" style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Konzentrations-Banner */}
      {konzZauber && (
        <div className="dnd-konz-banner">
          🧿 Konzentration: <strong>{konzZauber.name}</strong>
          <button className="dnd-icon-btn" style={{ marginLeft: 10 }}
            onClick={() => setKonzentration(null)}>✕ fallen lassen</button>
        </div>
      )}

      {/* Zauberschlitze */}
      <div className="dnd-section-header">
        <h2 className="sheet-title" style={{ margin: 0 }}>Zauberschlitze</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="dnd-rast-btn long" onClick={langeRast}>⛺ Lange Rast</button>
          <button className="dnd-rast-btn short" onClick={kurzeRast}>🌙 Kurze Rast</button>
          <button className="dnd-icon-btn" title="Schlitze einrichten"
            onClick={() => setKonfigMode(m => !m)}>⚙</button>
        </div>
      </div>

      {konfigMode && (
        <div className="dnd-slot-konfig">
          {SLOT_STUFEN.map(s => (
            <label key={s} className="dnd-slot-konfig-zeile">
              <span>Rang {s}</span>
              <input type="number" min={0} max={9} className="dnd-slot-max-input"
                value={char.zauberschlitze[s]?.max ?? 0}
                onChange={e => slotMaxSetzen(s, parseInt(e.target.value) || 0)} />
            </label>
          ))}
        </div>
      )}

      {aktiveSlots.length === 0 && !konfigMode ? (
        <p className="dnd-leer-hinweis">
          Noch keine Schlitze konfiguriert — klicke auf ⚙ um Schlitze einzurichten.
        </p>
      ) : (
        <div className="dnd-slot-bereich">
          {aktiveSlots.map(s => {
            const slot = char.zauberschlitze[s];
            return (
              <div key={s} className="dnd-slot-reihe">
                <span className="dnd-slot-label">Rang {s}</span>
                <div className="dnd-slot-pips">
                  {Array.from({ length: slot.max }).map((_, i) => {
                    const voll = i < slot.aktuell;
                    return (
                      <button key={i}
                        className={`dnd-slot-pip ${voll ? 'voll' : 'leer'}`}
                        onClick={() => voll ? slotNutzen(s) : slotAuffuellen(s)}
                        title={voll ? 'Verbrauchen' : 'Auffüllen'} />
                    );
                  })}
                </div>
                <span className="dnd-slot-count">{slot.aktuell}/{slot.max}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Ressourcen */}
      <div className="rule" />
      <div className="dnd-section-header">
        <div className="field-label" style={{ marginBottom: 0 }}>Ressourcen</div>
        <button className="gla-btn" style={{ fontSize: 13, padding: '4px 12px' }}
          onClick={() => setResForm(r => !r)}>+ Ressource</button>
      </div>

      {resForm && (
        <div className="dnd-form-box" style={{ marginTop: 8 }}>
          <div className="grid-2">
            <div>
              <div className="field-label">Name</div>
              <input className="gla-input" value={resDaten.name} autoFocus
                onChange={e => setResDaten(r => ({ ...r, name: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">Maximum</div>
              <input className="gla-input" type="number" min={1} max={99}
                value={resDaten.max}
                onChange={e => setResDaten(r => ({ ...r, max: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <div className="field-label">Aufladung</div>
              <select className="gla-input" value={resDaten.aufladung}
                onChange={e => setResDaten(r => ({ ...r, aufladung: e.target.value as DnDRessource['aufladung'] }))}>
                <option value="LONG_REST">Lange Rast</option>
                <option value="SHORT_REST">Kurze Rast</option>
                <option value="AT_WILL">Beliebig</option>
              </select>
            </div>
          </div>
          <div className="dnd-form-actions">
            <button className="gla-btn primary" onClick={speichernRes}>Hinzufügen</button>
            <button className="gla-btn" onClick={() => setResForm(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {char.ressourcen.length === 0 && !resForm && (
        <p className="dnd-leer-hinweis">Keine Ressourcen — z.B. Sorcery Points, Ki-Punkte hinzufügen.</p>
      )}

      <div className="dnd-ressourcen-liste">
        {char.ressourcen.map(r => {
          const aufladungLabel = r.aufladung === 'LONG_REST' ? 'L' : r.aufladung === 'SHORT_REST' ? 'K' : '∞';
          return (
            <div key={r.id} className="dnd-ressource-row">
              <span className="dnd-ressource-name">{r.name}</span>
              <div className="dnd-slot-pips">
                {Array.from({ length: r.max }).map((_, i) => {
                  const voll = i < r.aktuell;
                  return (
                    <button key={i}
                      className={`dnd-slot-pip ${voll ? 'voll ressource' : 'leer'}`}
                      onClick={() => voll ? ressourceNutzen(r.id) : ressourceZurueck(r.id)}
                      title={voll ? 'Verbrauchen' : 'Auffüllen'} />
                  );
                })}
              </div>
              <span className="dnd-slot-count">{r.aktuell}/{r.max}</span>
              <span className="dnd-res-aufladung" title={
                r.aufladung === 'LONG_REST' ? 'Lange Rast'
                : r.aufladung === 'SHORT_REST' ? 'Kurze Rast' : 'Beliebig'
              }>{aufladungLabel}</span>
              <button className="dnd-icon-btn danger" onClick={() => ressourceLoeschen(r.id)}>✕</button>
            </div>
          );
        })}
      </div>

      <div className="rule" />

      {/* Zauberliste */}
      <div className="dnd-section-header">
        <h2 className="sheet-title" style={{ margin: 0, fontSize: 22 }}>
          Bekannte Zauber
          <span className="dnd-db-info"> ({SPELL_DB_SRD} SRD{zeigeHomebrew ? ` + ${SPELL_DB_GROESSE - SPELL_DB_SRD} HB` : ''} in DB)</span>
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="gla-btn" onClick={oeffneNeuZauber}>+ Manuell</button>
        </div>
      </div>

      {/* Datenbank-Suche */}
      <div className="dnd-db-suche">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="gla-input dnd-db-input"
            placeholder="Zauber suchen (DE oder EN)…"
            value={dbSuche}
            onChange={e => sucheAktualisieren(e.target.value)}
          />
          <button
            className={`dnd-filter-btn ${zeigeDe ? 'active' : ''}`}
            onClick={toggleZeigeDe}
            title="Zwischen deutschem und englischem Namen umschalten"
          >{zeigeDe ? 'DE' : 'EN'}</button>
          <button
            className={`dnd-filter-btn ${zeigeHomebrew ? 'active' : ''}`}
            onClick={toggleZeigeHomebrew}
            title="Homebrew-Zauber (inoffizielle Quellen) ein-/ausblenden"
          >HB</button>
        </div>
        {dbErgebnisse.length > 0 && (
          <div className="dnd-db-ergebnisse">
            {dbErgebnisse.map(z => (
              <button
                key={z.slug}
                className="dnd-db-treffer"
                onClick={() => importiereAusDB(z)}
              >
                <span className="dnd-db-treffer-name">
                  {zeigeDe ? z.nameDe : z.name}
                  {zeigeDe && z.nameDe !== z.name && (
                    <span className="dnd-db-treffer-en"> ({z.name})</span>
                  )}
                  {z.isHomebrew && (
                    <span className="dnd-homebrew-badge">HB</span>
                  )}
                </span>
                <span className="dnd-db-treffer-meta">
                  {z.stufe === 0 ? 'Cantrip' : `Rang ${z.stufe}`} · {z.schule}
                </span>
              </button>
            ))}
          </div>
        )}
        {dbSuche && dbErgebnisse.length === 0 && (
          <div className="dnd-leer-hinweis" style={{ padding: '6px 0', textAlign: 'left' }}>
            Kein Treffer — Zauber manuell hinzufügen.
          </div>
        )}
      </div>

      {/* Stufen-Filter */}
      <div className="dnd-filter-leiste">
        <button className={`dnd-filter-btn ${filterStufe === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStufe('all')}>Alle</button>
        <button className={`dnd-filter-btn ${filterStufe === 0 ? 'active' : ''}`}
          onClick={() => setFilterStufe(filterStufe === 0 ? 'all' : 0)}>Cantrip</button>
        {SLOT_STUFEN.map(s => (
          <button key={s}
            className={`dnd-filter-btn ${filterStufe === s ? 'active' : ''}`}
            onClick={() => setFilterStufe(filterStufe === s ? 'all' : s)}>Rang {s}</button>
        ))}
      </div>

      {/* Zauber-Formular */}
      {zauberForm && (
        <div className="dnd-form-box">
          <div className="dnd-zauber-form-grid">
            <div>
              <div className="field-label">Name</div>
              <input className="gla-input" value={formDaten.name} autoFocus
                onChange={e => setFormDaten(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">Rang (0 = Cantrip)</div>
              <input className="gla-input" type="number" min={0} max={9}
                value={formDaten.stufe}
                onChange={e => setFormDaten(f => ({ ...f, stufe: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <div className="field-label">Schule</div>
              <input className="gla-input" value={formDaten.schule}
                onChange={e => setFormDaten(f => ({ ...f, schule: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">Herkunft</div>
              <select className="gla-input" value={formDaten.herkunft}
                onChange={e => setFormDaten(f => ({ ...f, herkunft: e.target.value as HerkunftArt }))}>
                {ALLE_HERKUENFTE.map(h => (
                  <option key={h} value={h}>{SOURCE_LABEL[h]}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="field-label">Aktion</div>
              <select className="gla-input" value={formDaten.aktion}
                onChange={e => setFormDaten(f => ({ ...f, aktion: e.target.value as AktionsTyp }))}>
                {ALLE_AKTIONEN.map(a => (
                  <option key={a} value={a}>{ACTION_LABEL[a]}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="field-label">Komponenten</div>
              <input className="gla-input" value={formDaten.komponenten}
                onChange={e => setFormDaten(f => ({ ...f, komponenten: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">Reichweite</div>
              <input className="gla-input" value={formDaten.reichweite}
                onChange={e => setFormDaten(f => ({ ...f, reichweite: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
              <label className="dnd-checkbox-label">
                <input type="checkbox" checked={formDaten.konzentration}
                  onChange={e => setFormDaten(f => ({ ...f, konzentration: e.target.checked }))} />
                🧿 Konzentration
              </label>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="field-label">Beschreibung</div>
            <textarea className="gla-textarea" value={formDaten.beschreibung} rows={3}
              onChange={e => setFormDaten(f => ({ ...f, beschreibung: e.target.value }))} />
          </div>
          <div className="dnd-form-actions">
            <button className="gla-btn primary" onClick={speichernZauber}>Speichern</button>
            <button className="gla-btn" onClick={() => { setZauberForm(false); setFormDaten(LEER_ZAUBER); setBearbeitenId(null); }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {sichtbareZauber.length === 0 && (
        <p className="dnd-leer-hinweis">Noch keine Zauber hinzugefügt.</p>
      )}

      <div className="dnd-zauber-liste">
        {sichtbareZauber.map(z => {
          const istKonz = char.konzentration === z.id;
          const offen = aufgeklappt.has(z.id);
          const nameEn = z.nameEn ?? z.slug ?? null;
          const srdLink = (!z.isHomebrew && nameEn) ? srdUrl(nameEn) : null;
          return (
            <div key={z.id} className={`dnd-zauber-item ${istKonz ? 'konzentriert' : ''}`}>
              <div className="dnd-zauber-header">
                <div className="dnd-zauber-info">
                  <span className="dnd-herkunft-badge"
                    style={{ background: SOURCE_COLOR[z.herkunft] }}>
                    {SOURCE_LABEL[z.herkunft]}
                  </span>
                  {z.isHomebrew && (
                    <span className="dnd-homebrew-badge">HB</span>
                  )}
                  {z.konzentration && (
                    <button
                      className={`dnd-konz-tag ${istKonz ? 'aktiv' : ''}`}
                      onClick={() => setKonzentration(istKonz ? null : z.id)}
                      title={istKonz ? 'Konzentration fallen lassen' : 'Konzentration aktivieren'}>
                      🧿
                    </button>
                  )}
                  <button className="dnd-zauber-name-btn" onClick={() => toggleAufgeklappt(z.id)}>
                    <strong>{z.name}</strong>
                    {z.nameEn && z.nameEn !== z.name && (
                      <span className="dnd-db-treffer-en"> ({z.nameEn})</span>
                    )}
                    <span className="dnd-zauber-meta-inline">
                      {z.stufe === 0 ? 'Cantrip' : `Rang ${z.stufe}`}
                      {z.schule && ` · ${z.schule}`}
                      {` · ${ACTION_LABEL[z.aktion]}`}
                    </span>
                    {(z.beschreibung || z.komponenten || z.reichweite) &&
                      <span className="dnd-merkmal-pfeil">{offen ? '▲' : '▼'}</span>}
                  </button>
                </div>
                <div className="dnd-merkmal-aktionen">
                  {srdLink && (
                    <a
                      className="dnd-srd-link"
                      href={srdLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Auf 5esrd.com nachschlagen"
                      onClick={e => e.stopPropagation()}
                    >SRD</a>
                  )}
                  <button className="dnd-icon-btn" onClick={() => oeffneBearbeiten(z)}>✎</button>
                  <button className="dnd-icon-btn danger" onClick={() => zauberLoeschen(z.id)}>✕</button>
                </div>
              </div>
              {offen && (
                <div className="dnd-merkmal-text">
                  {(z.komponenten || z.reichweite) && (
                    <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 4 }}>
                      {z.komponenten && <span>Komponenten: {z.komponenten}</span>}
                      {z.komponenten && z.reichweite && ' · '}
                      {z.reichweite && <span>Reichweite: {z.reichweite}</span>}
                    </div>
                  )}
                  {z.beschreibung && <div>{z.beschreibung}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
