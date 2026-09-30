/**
 * Branchement de Fatou dans /api/chat : pré-analyse de chaque tour, skill actif conservé d'un
 * message à l'autre, réponses directes (refus, questions) diffusées au format du chat.
 */
import type { UIMessage } from "ai";
import { FATOU_SKILLS, preparerTourFatou } from "./fatou.ts";
import { loadSkill } from "./skillLoader.ts";
import { router } from "./router.ts";
import { EtatFichiers } from "./stateStore.ts";
import { outilsInstagram } from "./aiTools.ts";
import { LANG } from "./config.ts";

export function texteUtilisateur(m: UIMessage): string {
  return (m.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join("\n").trim();
}

/** Réponse texte diffusée comme un message d'assistant (flux UI message du SDK). */
export function reponseEnFlux(texte: string): Response {
  const e = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
  const corps = [
    e({ type: "start", messageId: `fatou-${Date.now()}` }), e({ type: "start-step" }), e({ type: "text-start", id: "t0" }),
    e({ type: "text-delta", id: "t0", delta: texte }), e({ type: "text-end", id: "t0" }), e({ type: "finish-step" }), e({ type: "finish" }), "data: [DONE]\n\n",
  ].join("");
  return new Response(corps, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "x-vercel-ai-ui-message-stream": "v1" } });
}

export type PreparationFatou =
  | { type: "reponse"; response: Response }
  | { type: "modele"; systemeEnPlus: string; tools: ReturnType<typeof outilsInstagram> };

/**
 * Prépare le tour de Fatou. Un message de suite (« change la fin », « oui ») garde le skill en
 * cours : on le retrouve dans les messages précédents du propriétaire.
 */
export async function preparerFatouChat(messages: UIMessage[]): Promise<PreparationFatou> {
  const users = messages.filter((m) => m.role === "user").map(texteUtilisateur);
  const derniere = users[users.length - 1] ?? "";
  const etat = new EtatFichiers();
  const tools = outilsInstagram({ derniereReponse: derniere, skills: FATOU_SKILLS });
  const tour = await preparerTourFatou(derniere, etat);
  if (tour.type === "reponse") return { type: "reponse", response: reponseEnFlux(tour.texte) };
  if (tour.type === "modele") return { type: "modele", systemeEnPlus: tour.contexte, tools };
  // Pas de capacité dans ce message : skill actif retrouvé plus haut dans la conversation.
  for (let i = users.length - 2; i >= 0; i--) {
    const r = router(users[i], FATOU_SKILLS);
    if (r.type === "capacite") {
      return { type: "modele", systemeEnPlus: `# Capacité en cours : ${r.skill} (suite de la conversation)\nSuis ce SKILL.md tel quel.\n\n${loadSkill(r.skill).texte}`, tools };
    }
  }
  return { type: "modele", systemeEnPlus: "", tools };
}

/** Remplit les variables du prompt système de Fatou. */
export function remplirPromptFatou(prompt: string): string {
  return prompt.replaceAll("{{owner}}", "Fallou (Saturn Studio)").replaceAll("{{LANG}}", LANG === "fr" ? "French" : "English");
}
