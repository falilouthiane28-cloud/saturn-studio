/**
 * Composition du message WhatsApp d'AWA à partir de la personnalisation déjà
 * produite (`lead.outreach.email`). Un message WhatsApp n'est pas un email :
 * court, sans objet ni signature, un seul appel à l'action.
 *
 * Contraintes imposées par le code (R5) :
 *   - ≤ 600 caractères
 *   - pas de ligne d'objet, pas de bloc de signature
 *   - 1 seul appel à l'action
 *   - au plus 1 emoji
 *   - pas de MAJUSCULES criardes
 *
 * Fonction pure et testable : ne régénère rien via un LLM, elle condense le
 * message existant de façon déterministe.
 */

/**
 * Entrée minimale du composer : tout ce dont il a besoin d'un lead. Défini en
 * structurel pour que `Lead` (store, serveur) comme le modèle du composant
 * client soient acceptés sans importer le store côté client.
 */
export interface ComposeInput {
  name: string;
  ville: string;
  insights?: string;
  outreach?: { email?: string; whatsapp?: string };
}

export interface ComposedWhatsApp {
  /** Texte prêt pour l'envoi libre (fenêtre 24 h) ou l'aperçu éditable. */
  text: string;
  /** Variables pour un template ({{1}} = prénom marque/contact, {{2}} = accroche). */
  templateVariables: string[];
}

const MAX_LEN = 600;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

/** Retire un bloc de signature de type "Fallou — Saturn Studio" et les salutations finales. */
function stripSignature(text: string): string {
  return text
    .replace(/\n+\s*(cordialement|bien à vous|à bientôt|merci)[^\n]*$/i, "")
    .replace(/\n+\s*[-–—]{1,2}\s*\n?[\s\S]*$/, "") // tiret de signature + ce qui suit
    .replace(/\n+\s*Fallou[^\n]*$/i, "")
    .trim();
}

/** Limite le texte à un seul emoji (garde le premier, supprime les suivants). */
function capEmojis(text: string): string {
  let seen = false;
  return text.replace(EMOJI_RE, (m) => {
    if (seen) return "";
    seen = true;
    return m;
  });
}

/** Adoucit les MOTS en capitales (>3 lettres) en casse normale. */
function softenAllCaps(text: string): string {
  return text.replace(/\b[A-ZÀ-Ÿ]{4,}\b/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
}

/** Tronque proprement sur une frontière de phrase sous `max` caractères. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd()).trim();
}

/**
 * Compose le message WhatsApp d'un lead.
 * Source privilégiée : `outreach.whatsapp` si déjà éditée, sinon dérivée de
 * `outreach.email`. Sans personnalisation, une accroche neutre et honnête.
 */
export function composeWhatsAppMessage(lead: ComposeInput): ComposedWhatsApp {
  const existing = lead.outreach?.whatsapp?.trim();
  if (existing) {
    const text = finalize(existing);
    return { text, templateVariables: templateVarsFor(lead, text) };
  }

  const nom = lead.name;
  const ville = lead.ville;
  const email = lead.outreach?.email?.trim();

  let body: string;
  if (email) {
    // Garde l'essentiel : première phrase (fait précis) + une phrase de CTA.
    const cleaned = stripSignature(email).replace(/\r/g, "");
    const sentences = cleaned
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const first = sentences[0] ?? `Bonjour, je me permets de vous contacter au sujet de ${nom}.`;
    const cta =
      sentences.find((s) => /audit|échange|discuter|dispo|rendez|question|intéress/i.test(s)) ??
      "Seriez-vous ouvert à un court échange cette semaine ?";
    body = `Bonjour,\n\n${first}\n\n${cta}`;
  } else {
    body = `Bonjour, ici Fallou de Saturn Studio. En regardant ${nom} à ${ville}, j'ai une idée concrète pour vous faire gagner du temps. Ouvert à un court échange cette semaine ?`;
  }

  const text = finalize(body);
  return { text, templateVariables: templateVarsFor(lead, text) };
}

/** Applique toutes les contraintes R5 dans l'ordre. */
function finalize(text: string): string {
  let t = stripSignature(text);
  t = softenAllCaps(t);
  t = capEmojis(t);
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  t = clamp(t, MAX_LEN);
  return t;
}

/**
 * Variables de template : {{1}} = nom de l'entreprise, {{2}} = bénéfice court.
 * Les templates Meta ne peuvent pas contenir de saut de ligne dans une variable.
 */
function templateVarsFor(lead: ComposeInput, _text: string): string[] {
  const benefice =
    lead.insights?.split(/[.·]/)[0]?.trim().slice(0, 60) || "vous faire gagner du temps sur vos process";
  return [lead.name, benefice];
}
