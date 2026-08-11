import { IMAGE_BUCKET, requireSupabase } from "./supabase";
import { dataUrlToBlob } from "./images";
import { newUuid } from "./game";
import {
  normalizeCharacter, normalizeCrew, normalizeMap,
  normalizeLogbook, normalizeScene, normalizeDrawing,
} from "./normalize";
import type {
  Character, Crew, CampaignData, MapState,
  LogbookState, SceneState, DrawingState,
} from "../types";
import type { Storage } from "./storage";

type MapKind = "tracker" | "drawing" | "detail";

interface CharacterRow {
  id: string;
  owner: string;
  campaign_id: string;
  name: string;
  epithet: string | null;
  level: number;
  hp: number;
  damage: string | null;
  berries: number | string;
  bounty: number | string;
  appearance: string | null;
  goal: string | null;
  special: string | null;
  traits: string | null;
  attrs: unknown;
  inventory: unknown;
  weapons: unknown;
  skills: unknown;
  devil_fruit: unknown;
  portrait_path: string | null;
  sort_order: number;
}

/* ---------- Mappers ---------- */

function toCharacter(r: CharacterRow): Character {
  return normalizeCharacter({
    id: r.id,
    name: r.name,
    epithet: r.epithet,
    level: r.level,
    hp: r.hp,
    damage: r.damage,
    berries: Number(r.berries),
    bounty: Number(r.bounty),
    appearance: r.appearance,
    goal: r.goal,
    special: r.special,
    traits: r.traits,
    attrs: r.attrs,
    inventory: r.inventory,
    weapons: r.weapons,
    skills: r.skills,
    devilFruit: r.devil_fruit,
    portrait: r.portrait_path,
  });
}

function toRow(userId: string, campaignId: string, c: Character, sortOrder: number) {
  return {
    id: c.id,
    owner: userId,
    campaign_id: campaignId,
    name: c.name,
    epithet: c.epithet,
    level: c.level,
    hp: c.hp,
    damage: c.damage,
    berries: c.berries,
    bounty: c.bounty,
    appearance: c.appearance,
    goal: c.goal,
    special: c.special,
    traits: c.traits,
    attrs: c.attrs,
    inventory: c.inventory,
    weapons: c.weapons,
    skills: c.skills,
    devil_fruit: c.devilFruit,
    portrait_path: c.portrait,
    sort_order: sortOrder,
  };
}

/* ---------- Cloud storage ---------- */

export function createCloudStorage(userId: string): Storage {
  // For milestone 1 each user has exactly one campaign.
  // The column is still set everywhere so milestone 2
  // (shared campaigns) can be added without data migration.
  let campaignId: string | null = null;

  async function getCampaign(): Promise<string> {
    if (campaignId) return campaignId;
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("campaigns")
      .select("id")
      .eq("owner", userId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw error;
    if (data && data.length) {
      campaignId = data[0].id as string;
      return campaignId;
    }
    const { data: created, error: createErr } = await sb
      .from("campaigns")
      .insert({ owner: userId, name: "My Campaign" })
      .select("id")
      .single();
    if (createErr) throw createErr;
    campaignId = created.id as string;
    return campaignId;
  }

  async function loadMapRaw(kind: MapKind) {
    const sb = requireSupabase();
    const cid = await getCampaign();
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

  async function writeMap(kind: MapKind, payload: unknown, bgPath: string | null) {
    const sb = requireSupabase();
    const cid = await getCampaign();
    const { error } = await sb
      .from("maps")
      .upsert(
        { owner: userId, campaign_id: cid, kind, data: payload, bg_path: bgPath },
        { onConflict: "campaign_id,kind" },
      );
    if (error) throw error;
  }

  return {
    mode: "cloud",

    async loadAll(): Promise<CampaignData> {
      const sb = requireSupabase();
      const cid = await getCampaign();

      const [charsRes, crewRes, trackerRes, drawingRes, detailRes, logRes] = await Promise.all([
        sb.from("characters").select("*").eq("owner", userId).eq("campaign_id", cid)
          .order("sort_order", { ascending: true }),
        sb.from("crews").select("*").eq("owner", userId).eq("campaign_id", cid).maybeSingle(),
        loadMapRaw("tracker"),
        loadMapRaw("drawing"),
        loadMapRaw("detail"),
        sb.from("logbooks").select("*").eq("owner", userId).eq("campaign_id", cid).maybeSingle(),
      ]);

      if (charsRes.error) throw charsRes.error;
      if (crewRes.error) throw crewRes.error;
      if (logRes.error) throw logRes.error;

      const chars = (charsRes.data as CharacterRow[] | null ?? []).map(toCharacter);

      const crewRow = crewRes.data as Record<string, unknown> | null;
      const crew = normalizeCrew(crewRow ? {
        name: crewRow.name,
        jollyRoger: crewRow.jolly_roger_path,
        shipName: crewRow.ship_name,
        shipDescription: crewRow.ship_description,
        fleet: crewRow.fleet,
      } : null);

      const trackerData = (trackerRes?.data ?? {}) as Record<string, unknown>;
      const map = normalizeMap({ ...trackerData, bg: trackerRes?.bg_path ?? null });
      const drawing = normalizeDrawing(drawingRes?.data ?? null);
      const scene = normalizeScene(detailRes?.data ?? null);

      const logRow = logRes.data as Record<string, unknown> | null;
      const logbook = normalizeLogbook(logRow
        ? { notes: logRow.notes, quests: logRow.quests }
        : null);

      return { chars, crew, map, drawing, scene, logbook };
    },

    async saveCharacters(chars: Character[]) {
      const sb = requireSupabase();
      const cid = await getCampaign();
      if (!chars.length) return;
      const rows = chars.map((c, i) => toRow(userId, cid, c, i));
      const { error } = await sb.from("characters").upsert(rows);
      if (error) throw error;
    },

    async deleteCharacter(id: string) {
      const sb = requireSupabase();
      const { error } = await sb.from("characters").delete().eq("id", id).eq("owner", userId);
      if (error) throw error;
    },

    async saveCrew(crew: Crew) {
      const sb = requireSupabase();
      const cid = await getCampaign();
      const { error } = await sb.from("crews").upsert({
        owner: userId,
        campaign_id: cid,
        name: crew.name,
        jolly_roger_path: crew.jollyRoger,
        ship_name: crew.shipName,
        ship_description: crew.shipDescription,
        fleet: crew.fleet,
      }, { onConflict: "campaign_id" });
      if (error) throw error;
    },

    async saveMap(k: MapState) {
      await writeMap("tracker", { gridOn: k.gridOn, tokens: k.tokens }, k.bg);
    },

    async saveDrawing(z: DrawingState) {
      await writeMap("drawing", { grid: z.grid, buildings: z.buildings }, null);
    },

    async saveScene(s: SceneState) {
      await writeMap("detail", { objects: s.objects, bg: s.bg }, null);
    },

    async saveLogbook(l: LogbookState) {
      const sb = requireSupabase();
      const cid = await getCampaign();
      const { error } = await sb.from("logbooks").upsert({
        owner: userId,
        campaign_id: cid,
        notes: l.notes,
        quests: l.quests,
      }, { onConflict: "campaign_id" });
      if (error) throw error;
    },

    // Images go into Storage, not into the row: only the path is stored.
    // The prefix is the user ID — that is what the Storage policy checks.
    async saveImage(dataUrl: string): Promise<string> {
      if (!dataUrl.startsWith("data:")) return dataUrl;
      const sb = requireSupabase();
      const path = `${userId}/${newUuid()}.jpg`;
      const blob = await dataUrlToBlob(dataUrl);
      const { error } = await sb.storage
        .from(IMAGE_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      return path;
    },

    imageUrl(value: string | null): string | null {
      if (!value) return null;
      // Pass data URLs and full URLs through unchanged
      if (value.startsWith("data:") || value.startsWith("http")) return value;
      const sb = requireSupabase();
      return sb.storage.from(IMAGE_BUCKET).getPublicUrl(value).data.publicUrl;
    },
  };
}
