/* ============================================================
   Datenzugriffsschicht für Supabase.
   Übersetzt zwischen DB-Zeile (snake_case, jsonb) und den
   Prototyp-Objekten (camelCase), die der Rest der App benutzt.
   ============================================================ */

import { BILD_BUCKET, benoetigeSupabase } from "./supabase";
import { datenUrlZuBlob } from "./bilder";
import { neueUuid } from "./spiel";
import {
  normalisiereCharakter, normalisiereCrew, normalisiereKarte,
  normalisiereLogbuch, normalisiereSchauplatz, normalisiereZeichnung,
} from "./normalisieren";
import type {
  Charakter, Crew, KampagnenDaten, KartenZustand,
  LogbuchZustand, SchauplatzZustand, ZeichnungZustand,
} from "../types";
import type { Speicher } from "./speicher";

type KartenArt = "tracker" | "drawing" | "detail";

interface CharakterZeile {
  id: string;
  owner: string;
  campaign_id: string;
  name: string;
  epitheton: string | null;
  stufe: number;
  leben: number;
  schaden: string | null;
  berries: number | string;
  kopfgeld: number | string;
  aussehen: string | null;
  ziel: string | null;
  spezial: string | null;
  eigenschaften: string | null;
  attribute: unknown;
  hab_und_gut: unknown;
  waffen: unknown;
  skills: unknown;
  teufelsfrucht: unknown;
  portrait_path: string | null;
  sortierung: number;
}

/* ---------- Mapper ---------- */

function zuCharakter(r: CharakterZeile): Charakter {
  return normalisiereCharakter({
    id: r.id,
    name: r.name,
    epitheton: r.epitheton,
    stufe: r.stufe,
    leben: r.leben,
    schaden: r.schaden,
    berries: Number(r.berries),
    kopfgeld: Number(r.kopfgeld),
    aussehen: r.aussehen,
    ziel: r.ziel,
    spezial: r.spezial,
    eigenschaften: r.eigenschaften,
    attribute: r.attribute,
    habUndGut: r.hab_und_gut,
    waffen: r.waffen,
    skills: r.skills,
    teufelsfrucht: r.teufelsfrucht,
    portrait: r.portrait_path,
  });
}

function zuZeile(userId: string, campaignId: string, c: Charakter, sortierung: number) {
  return {
    id: c.id,
    owner: userId,
    campaign_id: campaignId,
    name: c.name,
    epitheton: c.epitheton,
    stufe: c.stufe,
    leben: c.leben,
    schaden: c.schaden,
    berries: c.berries,
    kopfgeld: c.kopfgeld,
    aussehen: c.aussehen,
    ziel: c.ziel,
    spezial: c.spezial,
    eigenschaften: c.eigenschaften,
    attribute: c.attribute,
    hab_und_gut: c.habUndGut,
    waffen: c.waffen,
    skills: c.skills,
    teufelsfrucht: c.teufelsfrucht,
    portrait_path: c.portrait,
    sortierung,
  };
}

/* ---------- Cloud-Speicher ---------- */

export function erstelleCloudSpeicher(userId: string): Speicher {
  // Für den ersten Meilenstein hat jeder Benutzer genau eine Kampagne.
  // Die Spalte ist trotzdem überall gesetzt, damit Meilenstein 2
  // (geteilte Kampagnen) ohne Datenwanderung nachrüstbar ist.
  let kampagneId: string | null = null;

  async function holeKampagne(): Promise<string> {
    if (kampagneId) return kampagneId;
    const sb = benoetigeSupabase();
    const { data, error } = await sb
      .from("campaigns")
      .select("id")
      .eq("owner", userId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw error;
    if (data && data.length) {
      kampagneId = data[0].id as string;
      return kampagneId;
    }
    const { data: neu, error: fehler } = await sb
      .from("campaigns")
      .insert({ owner: userId, name: "Meine Kampagne" })
      .select("id")
      .single();
    if (fehler) throw fehler;
    kampagneId = neu.id as string;
    return kampagneId;
  }

  async function ladeKarteRoh(kind: KartenArt) {
    const sb = benoetigeSupabase();
    const cid = await holeKampagne();
    const { data, error } = await sb
      .from("maps")
      .select("data, bg_path")
      .eq("owner", userId)
      .eq("campaign_id", cid)
      .eq("kind", kind)
      .maybeSingle();
    if (error) throw error;
    return data as { data: unknown; bg_path: string | null } | null;
  }

  async function schreibeKarte(kind: KartenArt, daten: unknown, bgPfad: string | null) {
    const sb = benoetigeSupabase();
    const cid = await holeKampagne();
    const { error } = await sb
      .from("maps")
      .upsert(
        { owner: userId, campaign_id: cid, kind, data: daten, bg_path: bgPfad },
        { onConflict: "campaign_id,kind" },
      );
    if (error) throw error;
  }

  return {
    modus: "cloud",

    async ladeAlles(): Promise<KampagnenDaten> {
      const sb = benoetigeSupabase();
      const cid = await holeKampagne();

      const [charsRes, crewRes, trackerRes, drawingRes, detailRes, logRes] = await Promise.all([
        sb.from("characters").select("*").eq("owner", userId).eq("campaign_id", cid)
          .order("sortierung", { ascending: true }),
        sb.from("crews").select("*").eq("owner", userId).eq("campaign_id", cid).maybeSingle(),
        ladeKarteRoh("tracker"),
        ladeKarteRoh("drawing"),
        ladeKarteRoh("detail"),
        sb.from("logbooks").select("*").eq("owner", userId).eq("campaign_id", cid).maybeSingle(),
      ]);

      if (charsRes.error) throw charsRes.error;
      if (crewRes.error) throw crewRes.error;
      if (logRes.error) throw logRes.error;

      const chars = (charsRes.data as CharakterZeile[] | null ?? []).map(zuCharakter);

      const crewZeile = crewRes.data as Record<string, unknown> | null;
      const crew = normalisiereCrew(crewZeile ? {
        name: crewZeile.name,
        jollyRoger: crewZeile.jolly_roger_path,
        schiffName: crewZeile.schiff_name,
        schiffBeschreibung: crewZeile.schiff_beschreibung,
        flotte: crewZeile.flotte,
      } : null);

      const trackerDaten = (trackerRes?.data ?? {}) as Record<string, unknown>;
      const karte = normalisiereKarte({ ...trackerDaten, bg: trackerRes?.bg_path ?? null });
      const zeichnung = normalisiereZeichnung(drawingRes?.data ?? null);
      const schauplatz = normalisiereSchauplatz(detailRes?.data ?? null);

      const logZeile = logRes.data as Record<string, unknown> | null;
      const logbuch = normalisiereLogbuch(logZeile
        ? { notizen: logZeile.notizen, quests: logZeile.quests }
        : null);

      return { chars, crew, karte, zeichnung, schauplatz, logbuch };
    },

    async speichereCharaktere(chars: Charakter[]) {
      const sb = benoetigeSupabase();
      const cid = await holeKampagne();
      if (!chars.length) return;
      const zeilen = chars.map((c, i) => zuZeile(userId, cid, c, i));
      const { error } = await sb.from("characters").upsert(zeilen);
      if (error) throw error;
    },

    async loescheCharakter(id: string) {
      const sb = benoetigeSupabase();
      const { error } = await sb.from("characters").delete().eq("id", id).eq("owner", userId);
      if (error) throw error;
    },

    async speichereCrew(crew: Crew) {
      const sb = benoetigeSupabase();
      const cid = await holeKampagne();
      const { error } = await sb.from("crews").upsert({
        owner: userId,
        campaign_id: cid,
        name: crew.name,
        jolly_roger_path: crew.jollyRoger,
        schiff_name: crew.schiffName,
        schiff_beschreibung: crew.schiffBeschreibung,
        flotte: crew.flotte,
      }, { onConflict: "campaign_id" });
      if (error) throw error;
    },

    async speichereKarte(k: KartenZustand) {
      await schreibeKarte("tracker", { gridOn: k.gridOn, tokens: k.tokens }, k.bg);
    },

    async speichereZeichnung(z: ZeichnungZustand) {
      await schreibeKarte("drawing", { grid: z.grid, buildings: z.buildings }, null);
    },

    async speichereSchauplatz(s: SchauplatzZustand) {
      await schreibeKarte("detail", { objects: s.objects, bg: s.bg }, null);
    },

    async speichereLogbuch(l: LogbuchZustand) {
      const sb = benoetigeSupabase();
      const cid = await holeKampagne();
      const { error } = await sb.from("logbooks").upsert({
        owner: userId,
        campaign_id: cid,
        notizen: l.notizen,
        quests: l.quests,
      }, { onConflict: "campaign_id" });
      if (error) throw error;
    },

    // Bilder gehören in den Storage, nicht in die Zeile: gespeichert wird
    // nur der Pfad. Der Präfix ist die User-ID — darauf greift die
    // Storage-Policy zu.
    async bildSpeichern(datenUrl: string): Promise<string> {
      if (!datenUrl.startsWith("data:")) return datenUrl;
      const sb = benoetigeSupabase();
      const pfad = `${userId}/${neueUuid()}.jpg`;
      const blob = await datenUrlZuBlob(datenUrl);
      const { error } = await sb.storage
        .from(BILD_BUCKET)
        .upload(pfad, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      return pfad;
    },

    bildUrl(wert: string | null): string | null {
      if (!wert) return null;
      // Data-URLs und fertige Links unverändert durchreichen
      if (wert.startsWith("data:") || wert.startsWith("http")) return wert;
      const sb = benoetigeSupabase();
      return sb.storage.from(BILD_BUCKET).getPublicUrl(wert).data.publicUrl;
    },
  };
}
