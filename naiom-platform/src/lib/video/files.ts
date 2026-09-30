/**
 * Transferts de gros fichiers vidéo sans les charger en mémoire (serveur à 2 Go de RAM) :
 * écriture en flux depuis le corps de la requête, lecture en flux avec prise en charge
 * des requêtes Range (lecture et avance rapide dans le lecteur vidéo du navigateur).
 */
import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024; // 1 Go par fichier

const MIME: Record<string, string> = {
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".m4v": "video/mp4", ".mkv": "video/x-matroska",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".json": "application/json",
};
export const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv)$/i;

/** Écrit le corps de la requête dans `dest` (via un fichier temporaire). Renvoie la taille. */
export async function saveBody(req: Request, dest: string, max = MAX_UPLOAD_BYTES): Promise<number> {
  if (!req.body) throw new Error("Corps de requête vide.");
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  let size = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      cb(size > max ? new Error(`Fichier trop lourd (max ${Math.round(max / 1024 / 1024)} Mo).`) : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(req.body as import("node:stream/web").ReadableStream), limit, fs.createWriteStream(tmp));
    await fs.promises.rename(tmp, dest);
    return size;
  } catch (e) {
    await fs.promises.rm(tmp, { force: true });
    throw e;
  }
}

/** Réponse en flux pour un fichier, avec Range. `download` force l'enregistrement. */
export async function fileResponse(req: Request, file: string, download?: string): Promise<Response> {
  const stat = await fs.promises.stat(file).catch(() => null);
  if (!stat?.isFile()) return new Response("Introuvable", { status: 404 });
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
  if (download) headers["Content-Disposition"] = `attachment; filename="${download.replace(/"/g, "")}"`;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(stat.size) } });
}

/**
 * Envoi par morceaux (reprise possible) : chaque requête ajoute un morceau à `dest.part`
 * à l'octet `offset` ; `final` publie le fichier. Évite les coupures des requêtes longues
 * (Node coupe au-delà de 5 min) sur une connexion montante lente.
 * Renvoie la taille reçue ; si `offset` ne correspond pas, lève une erreur avec la bonne valeur.
 */
export class OffsetMismatch extends Error {
  constructor(public expected: number) { super(`Reprendre à l'octet ${expected}.`); }
}
export async function saveChunk(req: Request, dest: string, offset: number, final: boolean, max = MAX_UPLOAD_BYTES): Promise<number> {
  if (!req.body) throw new Error("Corps de requête vide.");
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  if (offset === 0) await fs.promises.rm(part, { force: true });
  const current = (await fs.promises.stat(part).catch(() => null))?.size ?? 0;
  if (current !== offset) throw new OffsetMismatch(current);
  let size = current;
  const limit = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      cb(size > max ? new Error(`Fichier trop lourd (max ${Math.round(max / 1024 / 1024)} Mo).`) : null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(req.body as import("node:stream/web").ReadableStream), limit, fs.createWriteStream(part, { flags: "a" }));
  if (final) await fs.promises.rename(part, dest);
  return size;
}
