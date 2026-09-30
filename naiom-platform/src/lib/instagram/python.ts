/**
 * Exécution des scripts Python d'origine du pack (référence unique des calculs).
 * Sécurité : execFile sans shell, script et options sur liste blanche, délai maximal,
 * dossier de travail jetable, entrée par stdin ou par fichier écrit dans ce dossier.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const SKILLS_DIR = process.env.IG_SKILLS_DIR ?? path.join(process.cwd(), "agents", "skills", "instagram");
export const SATURN_DIR = path.join(SKILLS_DIR, "_saturn");
export const PYTHON = process.env.IG_PYTHON ?? (process.platform === "win32" ? "python" : "python3");

/** Scripts autorisés et leurs options (true = l'option attend une valeur). */
const SCRIPTS = {
  hookscore: { file: "ig-reel/hookscore.py", flags: { "--json": false, "--hook": true } },
  beats: { file: "ig-reel/beats.py", flags: { "--json": false, "--target": true, "--wpm": true } },
  caption: { file: "ig-caption/caption.py", flags: { "--json": false, "--keywords": true, "--truncate": true } },
  humanize: { file: "ig-human/humanize.py", flags: { "--json": false, "--lexicon": true } },
  detect: { file: "ig-human/detect.py", flags: { "--json": false, "--lexicon": true } },
  swipe: { file: "ig-viral/swipe.py", flags: { "--json": false, "--hooks": true, "--out": true } },
} as const;
export type ScriptName = keyof typeof SCRIPTS;

export interface PyResult { stdout: string; stderr: string; code: number }

/** Contrôle d'un argument : option connue, valeur courte d'option, ou chemin dans un dossier autorisé. */
function verifierArgs(name: ScriptName, args: string[], allowedDirs: string[]): void {
  const flags = SCRIPTS[name].flags as Record<string, boolean>;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a in flags) {
      if (flags[a]) {
        const v = args[++i];
        if (v === undefined || v.length > 2000 || /[\0\r\n]/.test(v)) throw new Error(`Valeur invalide pour ${a}`);
        if (a === "--lexicon" || a === "--hooks" || a === "--out") verifierChemin(v, allowedDirs);
      }
      continue;
    }
    if (a === "-") continue;
    verifierChemin(a, allowedDirs); // fichier d'entrée (ou fichier de comparaison pour detect)
  }
}
function verifierChemin(p: string, allowedDirs: string[]): void {
  const abs = path.resolve(p);
  if (!allowedDirs.some((d) => abs === d || abs.startsWith(d + path.sep))) throw new Error(`Chemin hors des dossiers autorisés : ${p}`);
}

/**
 * Lance un script du pack. `withScratch` reçoit le dossier de travail pour y écrire des
 * fichiers d'entrée avant l'exécution ; il renvoie les arguments à passer.
 */
export async function runPython(
  name: ScriptName,
  withScratch: (scratch: string) => Promise<string[]> | string[],
  opts: { stdin?: string; timeoutMs?: number; extraDirs?: string[] } = {},
): Promise<PyResult> {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "ig-"));
  try {
    const args = await withScratch(scratch);
    verifierArgs(name, args, [path.resolve(scratch), path.resolve(SKILLS_DIR), ...(opts.extraDirs ?? []).map((d) => path.resolve(d))]);
    const script = path.join(SKILLS_DIR, SCRIPTS[name].file);
    return await new Promise<PyResult>((resolve, reject) => {
      const child = execFile(PYTHON, [script, ...args], {
        cwd: scratch,
        timeout: opts.timeoutMs ?? 20_000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        // Entrées et sorties en UTF-8 partout (Windows lit sinon en cp1252 et abîme les accents).
        env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
      }, (err, stdout, stderr) => {
        const code = err && typeof (err as NodeJS.ErrnoException & { code?: unknown }).code === "number" ? Number((err as { code: number }).code) : err ? -1 : 0;
        // Les scripts sortent en 1 pour signaler un verdict faible : ce n'est pas une panne.
        if (err && (code === -1 || code >= 2 || (err as { killed?: boolean }).killed)) {
          reject(new Error(`${name} a échoué (${code}) : ${String(stderr || err.message).slice(0, 400)}`));
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr), code });
      });
      child.stdin?.end(opts.stdin ?? "");
    });
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

/** Variante qui attend une sortie --json et la renvoie décodée. */
export async function runPythonJson<T>(name: ScriptName, withScratch: (scratch: string) => Promise<string[]> | string[], opts: Parameters<typeof runPython>[2] = {}): Promise<T> {
  const r = await runPython(name, withScratch, opts);
  try { return JSON.parse(r.stdout) as T; }
  catch { throw new Error(`${name} : sortie JSON illisible (${r.stdout.slice(0, 200)}${r.stderr.slice(0, 200)})`); }
}
