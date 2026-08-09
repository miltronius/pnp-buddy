/* ============================================================
   Druckansicht des Charakterbogens.
   Baut ein eigenständiges HTML-Dokument im Piraten-Stil und
   öffnet den Druckdialog — daraus wird per "Als PDF sichern"
   ein sauberer A4-Bogen.
   ============================================================ */

import { ATTRIBUTE, type Charakter } from "../types";
import { balanceValue, withSign } from "./game";

const esc = (t: unknown): string =>
  String(t == null ? "" : t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const nl = (t: unknown): string => esc(t).replace(/\n/g, "<br>");

export function exportPdf(a: Charakter, zeigeToast: (t: string) => void): void {
  const attrRows = ATTRIBUTE.map(name =>
    `<div class="p-att"><span class="p-att-name">${esc(name)}</span>` +
    `<span class="p-att-val">${esc(a.attribute[name])}</span>` +
    `<span class="p-att-mod">${withSign(balanceValue(a.attribute[name]))}</span></div>`,
  ).join("");

  const items = (a.habUndGut || []).filter(it => (it.text || "").trim());
  const invRows = items.length
    ? items.map(it => `<tr><td class="p-qty">${esc(it.anzahl)}×</td><td>${esc(it.text)}</td></tr>`).join("")
    : `<tr><td colspan="2" class="p-empty">—</td></tr>`;

  const weapons = (a.waffen || []).filter(w => (w.name || "").trim() || (w.schaden || "").trim());
  const weaponRows = weapons.length
    ? weapons.map(w => `<tr><td>${esc(w.name)}</td><td>${esc(w.att)}</td><td>${esc(w.schaden)}</td></tr>`).join("")
    : "";

  const skills = (a.skills || []).filter(sk => (sk.name || "").trim());
  const skillRows = skills.length
    ? skills.map(sk =>
        `<div class="p-skill"><b>${esc(sk.name)}</b>` +
        `${sk.att ? ` <span class="p-skill-att">(${esc(sk.att)})</span>` : ""}` +
        `<div class="p-skill-desc">${nl(sk.beschreibung)}</div></div>`).join("")
    : "";

  const frucht = a.teufelsfrucht || { name: "", typ: "", raenge: [] };
  const fruchtRaenge = (frucht.raenge || [])
    .filter(r => r.unlocked && ((r.name || "").trim() || (r.beschreibung || "").trim()));
  const fruchtBlock = (frucht.name || fruchtRaenge.length)
    ? `<h2>Teufelsfrucht</h2>
       <div class="p-frucht-name">${esc(frucht.name || "—")}${frucht.typ ? ` <span class="p-skill-att">(${esc(frucht.typ)})</span>` : ""}</div>
       ${fruchtRaenge.map((r, i) =>
         `<div class="p-rang"><b>${i + 1}. ${esc(r.name)}</b>` +
         `${r.kostenText ? ` <span class="p-skill-att">— ${esc(r.kostenText)}</span>` : ""}` +
         `<div class="p-skill-desc">${nl(r.beschreibung)}` +
         `${r.wurfTyp === "schaden" ? `  <i>Schaden: ${esc(r.wurfSchaden)}</i>`
            : r.wurfTyp === "probe" ? `  <i>Probe: ${esc(r.wurfAtt)}</i>` : ""}` +
         `</div></div>`).join("")}`
    : "";

  const stufe = a.stufe > 0 ? `Stufe ${a.stufe}` : "Stufe 0 (Landratte)";
  const field = (label: string, val: string) =>
    `<div class="p-field"><div class="p-label">${esc(label)}</div><div class="p-value">${nl(val) || "&nbsp;"}</div></div>`;

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>${esc(a.name || "Charakterbogen")} — Charakterbogen</title>
<link href="https://fonts.googleapis.com/css2?family=Pirata+One&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'IM Fell English', Georgia, serif; color: #2b2014; margin: 0;
    background: #e7d3a8;
    background-image:
      radial-gradient(ellipse at 18% 8%, rgba(255,255,255,.35), transparent 45%),
      radial-gradient(ellipse at 85% 92%, rgba(106,72,28,.18), transparent 55%);
  }
  .sheet { max-width: 190mm; margin: 0 auto; padding: 6mm; }
  h1 { font-family: 'Pirata One', Georgia, serif; font-weight: 400; text-align: center;
       font-size: 30pt; margin: 0 0 2mm; letter-spacing: 1px; }
  .sub { text-align: center; font-style: italic; margin-bottom: 4mm; opacity: .7; }
  .rule { height: 2px; background: repeating-linear-gradient(90deg,#2b2014 0 12px,transparent 12px 18px);
          opacity: .7; margin: 3mm 0; }
  .row { display: flex; gap: 5mm; }
  .col { flex: 1; }
  .p-field { margin-bottom: 3mm; }
  .p-label { font-family: 'Pirata One', Georgia, serif; font-size: 12pt; letter-spacing: .5px; }
  .p-value { border-bottom: 1px solid rgba(43,32,20,.5); min-height: 6mm; padding: 1mm 1mm 0; font-size: 11pt; }
  .p-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2mm; }
  .p-head .stufe { font-family: 'Pirata One', Georgia, serif; font-size: 14pt; }
  .vitals { display: flex; gap: 6mm; margin: 2mm 0 3mm; }
  .vital { font-family: 'Pirata One', Georgia, serif; font-size: 13pt; }
  .vital small { font-family: 'IM Fell English', serif; font-style: italic; font-size: 9pt; display: block; opacity: .7; }
  h2 { font-family: 'Pirata One', Georgia, serif; font-weight: 400; font-size: 16pt; margin: 4mm 0 2mm; }
  .att-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm 4mm; }
  .p-att { display: flex; align-items: center; gap: 2mm; border: 1.5px solid #2b2014;
           border-radius: 4px; padding: 1.5mm 3mm; }
  .p-att-name { font-family: 'Pirata One', serif; font-size: 10.5pt; flex: 1; }
  .p-att-val { font-family: 'Pirata One', serif; font-size: 14pt; }
  .p-att-mod { font-family: 'Pirata One', serif; font-size: 11pt; color: #8b2e1f; min-width: 8mm; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  td { border-bottom: 1px dotted rgba(43,32,20,.4); padding: 1.2mm 1mm; }
  .p-qty { width: 12mm; font-family: 'Pirata One', serif; }
  .p-empty { text-align: center; opacity: .5; }
  .p-weapons th { text-align: left; font-family: 'Pirata One', serif; font-weight: 400; font-size: 10pt; border-bottom: 1.5px solid #2b2014; }
  .p-skill { margin-bottom: 2.5mm; }
  .p-skill-att { color: #8b2e1f; font-style: italic; }
  .p-skill-desc { font-size: 10pt; padding-left: 3mm; }
  .p-frucht-name { font-family: 'Pirata One', serif; font-size: 13pt; margin-bottom: 1.5mm; }
  .p-rang { margin-bottom: 2mm; }
  .berries { text-align: right; font-family: 'Pirata One', serif; font-size: 13pt; margin-top: 2mm; }
  .foot { text-align: center; font-style: italic; opacity: .55; font-size: 9pt; margin-top: 6mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body><div class="sheet">
  <h1>${esc(a.name || "Namenloser Pirat")}</h1>
  <div class="sub">☠ Grand Line Assistant — Charakterbogen ☠</div>
  <div class="rule"></div>
  <div class="p-head"><span class="stufe">${esc(stufe)}</span></div>
  <div class="vitals">
    <span class="vital">❤ ${esc(a.leben)}<small>Leben</small></span>
    <span class="vital">⚔ ${esc(a.schaden)}<small>Schaden</small></span>
    <span class="vital">☠ ${esc(a.berries)}<small>Berries</small></span>
  </div>
  <div class="row">
    <div class="col">${field("Aussehen", a.aussehen)}${field("Spezialeigenschaften", a.spezial)}</div>
    <div class="col">${field("Ziel im Leben", a.ziel)}${field("Eigenschaften", a.eigenschaften)}</div>
  </div>
  <h2>Attribute</h2>
  <div class="att-grid">${attrRows}</div>
  ${weaponRows ? `<h2>Waffen</h2><table class="p-weapons"><tr><th>Waffe</th><th>Trefferwurf</th><th>Schaden</th></tr>${weaponRows}</table>` : ""}
  ${skillRows ? `<h2>Skills</h2><div class="p-skills">${skillRows}</div>` : ""}
  ${fruchtBlock}
  <h2>Hab und Gut</h2>
  <table>${invRows}</table>
  <div class="foot">Ausgedruckt aus dem Grand Line Assistant</div>
</div>
<script>window.onload = () => { setTimeout(() => window.print(), 350); };<\/script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    zeigeToast("Bitte Pop-ups erlauben, dann klappt der Druck ⚓");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
