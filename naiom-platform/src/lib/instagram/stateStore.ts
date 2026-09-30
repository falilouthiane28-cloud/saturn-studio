/**
 * Fichiers d'état des skills : voice.md, swipe.md, log.md, plan.md — mêmes noms que ceux que les
 * skills lisent et écrivent. Adaptateur fichiers par défaut, dans le dossier d'état Instagram
 * (~/.claude/instagram/ en usage Claude Code ; IG_STATE_DIR sur le serveur).
 * log.md n'accepte que des ajouts, et seulement après le « oui » du propriétaire.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const FICHIERS_ETAT = ["voice.md", "swipe.md", "log.md", "plan.md"] as const;
export type FichierEtat = (typeof FICHIERS_ETAT)[number];

/** Interface commune : un autre adaptateur (Supabase, par utilisateur) n'a qu'à l'implémenter. */
export interface AdaptateurEtat {
  lire(nom: FichierEtat): Promise<string | null>;
  ecrire(nom: Exclude<FichierEtat, "log.md">, contenu: string): Promise<void>;
  ajouterAuJournal(ligne: string): Promise<void>;
}

export const DOSSIER_ETAT_DEFAUT = process.env.IG_STATE_DIR ?? path.join(os.homedir(), ".claude", "instagram");

export class EtatFichiers implements AdaptateurEtat {
  readonly dossier: string;
  constructor(dossier: string = DOSSIER_ETAT_DEFAUT) {
    this.dossier = dossier;
  }

  private chemin(nom: FichierEtat): string {
    if (!FICHIERS_ETAT.includes(nom)) throw new Error(`Fichier d'état inconnu : ${nom}`);
    return path.join(this.dossier, nom);
  }

  async lire(nom: FichierEtat): Promise<string | null> {
    try { return await fs.readFile(this.chemin(nom), "utf8"); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
  }

  async ecrire(nom: Exclude<FichierEtat, "log.md">, contenu: string): Promise<void> {
    if ((nom as string) === "log.md") throw new Error("log.md n'accepte que des ajouts.");
    await fs.mkdir(this.dossier, { recursive: true });
    const tmp = `${this.chemin(nom)}.tmp`;
    await fs.writeFile(tmp, contenu, "utf8");
    await fs.rename(tmp, this.chemin(nom));
  }

  async ajouterAuJournal(ligne: string): Promise<void> {
    await fs.mkdir(this.dossier, { recursive: true });
    await fs.appendFile(this.chemin("log.md"), ligne.endsWith("\n") ? ligne : `${ligne}\n`, "utf8");
  }
}

/** Seules réponses qui valent accord pour journaliser (règle 6 : rien n'est journalisé avant « oui »). */
export function estUnOui(reponse: string): boolean {
  return /^\s*(?:oui|yes|ok(?:ay)?|vas-y|go|c'est bon|valide|je valide)\s*[.!]*\s*$/i.test(reponse);
}

/** Journalise seulement si la réponse du propriétaire est un « oui » explicite. */
export async function journaliserApresAccord(etat: AdaptateurEtat, reponseProprietaire: string, ligne: string): Promise<boolean> {
  if (!estUnOui(reponseProprietaire)) return false;
  await etat.ajouterAuJournal(ligne);
  return true;
}
