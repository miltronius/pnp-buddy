/* ============================================================
   Bildverarbeitung — clientseitig verkleinern, bevor irgendetwas
   gespeichert oder hochgeladen wird. Der Prototyp-Code bleibt
   sinnvoll: kleine Bilder sparen Transfer und Storage-Kosten.
   ============================================================ */

function dateiLesen(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });
}

function bildLaden(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    img.src = src;
  });
}

/**
 * Verkleinert ein Bild auf eine maximale Kantenlänge und senkt die
 * JPEG-Qualität so lange, bis die Data-URL unter das Limit passt.
 * `square` beschneidet vorher mittig auf ein Quadrat (Porträt, Flagge).
 */
export async function loadImageScaled(
  file: File,
  maxEdge: number,
  opts: { square?: boolean; limit?: number } = {},
): Promise<string> {
  const { square = false, limit = 900_000 } = opts;
  if (!file || !/^image\//.test(file.type)) throw new Error("Bitte ein Bild wählen");

  const datenUrl = await dateiLesen(file);
  const img = await bildLaden(datenUrl);

  let w = img.width, h = img.height;
  let sx = 0, sy = 0, sw = w, sh = h;
  if (square) {
    const side = Math.min(w, h);
    sx = (w - side) / 2;
    sy = (h - side) / 2;
    sw = sh = side;
    w = h = side;
  }
  let dw = w, dh = h;
  if (dw > maxEdge || dh > maxEdge) {
    const sc = maxEdge / Math.max(dw, dh);
    dw = Math.round(dw * sc);
    dh = Math.round(dh * sc);
  }

  const cv = document.createElement("canvas");
  cv.width = dw;
  cv.height = dh;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

  let q = 0.85;
  let url = cv.toDataURL("image/jpeg", q);
  while (url.length > limit && q > 0.4) {
    q -= 0.15;
    url = cv.toDataURL("image/jpeg", q);
  }
  return url;
}

/** Kartenhintergrund: größere Kante erlaubt, großzügigeres Limit. */
export function karteSkalieren(file: File): Promise<string> {
  return loadImageScaled(file, 1600, { limit: 4_000_000 });
}

/** Data-URL → Blob, damit sie in den Supabase-Storage hochgeladen werden kann. */
export async function datenUrlZuBlob(datenUrl: string): Promise<Blob> {
  const res = await fetch(datenUrl);
  return await res.blob();
}
