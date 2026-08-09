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

export async function loadImageScaled(
  file: File,
  maxEdge: number,
  opts: { square?: boolean; limit?: number } = {},
): Promise<string> {
  const { square = false, limit = 900_000 } = opts;
  if (!file || !/^image\//.test(file.type)) throw new Error("Bitte ein Bild wählen");

  const dataUrl = await dateiLesen(file);
  const img = await bildLaden(dataUrl);

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

export function scaleMapImage(file: File): Promise<string> {
  return loadImageScaled(file, 1600, { limit: 4_000_000 });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}
