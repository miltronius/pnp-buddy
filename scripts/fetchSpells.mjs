/**
 * Fetches all SRD spells from the Open5e API (CC-BY-4.0)
 * and saves them as src/data/dndSpells.json.
 *
 * Run once:
 *   node scripts/fetchSpells.mjs
 *
 * Requires Node 18+ (native fetch).
 * Source: https://open5e.com — data under CC-BY-4.0
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, "../src/data/dndSpells.json");

// Document keys considered official SRD (not homebrew)
const SRD_DOCS = new Set(["srd-2014", "srd-2024"]);

const SCHOOLS_DE = {
  abjuration: "Bannmagie",
  conjuration: "Beschwörung",
  divination: "Wahrsagerei",
  enchantment: "Verzauberung",
  evocation: "Hervorrufung",
  illusion: "Illusion",
  necromancy: "Nekromantie",
  transmutation: "Verwandlung",
};

function mapAction(castingTime) {
  const t = (castingTime ?? "").toLowerCase();
  if (t.includes("bonus action") || t === "bonus_action") return "BONUS";
  if (t.includes("reaction")) return "REACTION";
  if (t.includes("action") || t === "action") return "ACTION";
  return "NONE";
}

function mapSchool(school) {
  const name = (typeof school === "string" ? school : school?.name ?? "").toLowerCase();
  return SCHOOLS_DE[name] ?? name;
}

function isConcentration(raw) {
  if (typeof raw === "boolean") return raw;
  return (raw ?? "").toString().toLowerCase().includes("concentration");
}

function mapComponents(raw) {
  if (typeof raw === "object" && raw !== null) {
    const parts = [];
    if (raw.verbal) parts.push("V");
    if (raw.somatic) parts.push("S");
    if (raw.material) parts.push("M");
    return parts.join(", ");
  }
  return raw ?? "";
}

function mapSpell(raw) {
  const components = (raw.verbal !== undefined)
    ? mapComponents(raw)
    : (raw.components ?? "");

  const concentration = (typeof raw.concentration === "boolean")
    ? raw.concentration
    : isConcentration(raw.duration);

  const sourceDoc = raw.document?.key ?? "";
  const isHomebrew = !SRD_DOCS.has(sourceDoc);

  return {
    slug: raw.key ?? raw.name?.toLowerCase().replace(/\s+/g, "-"),
    name: raw.name,
    stufe: raw.level ?? raw.level_int ?? 0,
    schule: mapSchool(raw.school),
    aktion: mapAction(raw.casting_time),
    konzentration: concentration,
    beschreibung: raw.desc ?? "",
    komponenten: components,
    reichweite: raw.range_text ?? raw.range ?? "",
    isHomebrew,
    sourceDoc,
  };
}

async function fetchAll(url) {
  const results = [];
  let next = url;
  while (next) {
    console.log("  →", next);
    const res = await fetch(next);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${next}`);
    const json = await res.json();
    const page = json.results ?? json;
    if (Array.isArray(page)) results.push(...page);
    next = json.next ?? null;
  }
  return results;
}

async function main() {
  console.log("Fetching spells from Open5e…");

  let raw1 = [];
  try {
    raw1 = await fetchAll(
      "https://api.open5e.com/v2/spells/?format=json&document__slug=srd-2014&limit=500"
    );
    console.log(`  ${raw1.length} spells from SRD 5.1`);
  } catch { console.log("  SRD 5.1 unavailable."); }

  let raw2 = [];
  try {
    raw2 = await fetchAll(
      "https://api.open5e.com/v2/spells/?format=json&document__slug=srd-2024&limit=500"
    );
    console.log(`  ${raw2.length} spells from SRD 5.2 (2024)`);
  } catch { console.log("  SRD 5.2 unavailable."); }

  // SRD 5.2 takes precedence for duplicate names
  const allRaw = [...raw1, ...raw2];
  const dedup = new Map();
  for (const z of allRaw) dedup.set(z.name?.toLowerCase(), z);

  const mapped = [...dedup.values()].map(mapSpell);
  mapped.sort((a, b) => a.stufe - b.stufe || a.name.localeCompare(b.name));

  const srdCount = mapped.filter(z => !z.isHomebrew).length;
  const homebrewCount = mapped.filter(z => z.isHomebrew).length;

  writeFileSync(OUT, JSON.stringify(mapped, null, 2), "utf8");
  console.log(`✓ ${mapped.length} spells saved (${srdCount} SRD, ${homebrewCount} homebrew) → ${OUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });
