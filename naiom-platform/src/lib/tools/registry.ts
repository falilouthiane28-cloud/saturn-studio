/**
 * Registre des outils des agents — la couche « connecteurs » unique.
 *
 * Chaque outil déclare sa plateforme et son type :
 *  - "read"  : lecture, s'exécute directement ;
 *  - "write" : action visible à l'extérieur (envoi, publication) → exige
 *              l'approbation de l'utilisateur dans le chat avant exécution.
 *
 * Les outils appellent les sources LIVE uniquement : si une connexion manque,
 * ils lèvent une erreur explicite (jamais de repli sur des données de démo).
 */
import { fetchYouTubeSnapshot, renderYouTubeForPrompt, searchPublicVideos } from "@/lib/integrations/youtube";
import { hashtagReels, creatorReels, type Reel } from "@/lib/integrations/instagram";
import { tiktokTrends } from "@/lib/integrations/tiktok";
import { fetchGmailInbox } from "@/lib/integrations/gmail";
import { sendEmail } from "@/lib/integrations/gmailSend";
import { fetchRecentDriveFiles, renderDriveForPrompt } from "@/lib/integrations/drive";
import { fetchFirefliesMeetings, isFirefliesConfigured } from "@/lib/integrations/fireflies";
import { publishLinkedInPost } from "@/lib/integrations/linkedin";
import { publishInstagram } from "@/lib/integrations/instagramPublish";
import { TOOL_META, type Platform, type ToolKind } from "@/lib/tools/meta";

function meta(name: string) {
  return { name, ...TOOL_META[name] };
}


export interface ToolDef {
  name: string;
  platform: Platform;
  kind: ToolKind;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

const str = (description: string) => ({ type: "string", description });
const int = (description: string, minimum: number, maximum: number) => ({ type: "integer", description, minimum, maximum });
const strList = (description: string) => ({ type: "array", items: { type: "string" }, minItems: 1, maxItems: 5, description });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

/** Reel réduit aux champs utiles à l'analyse (le brut est très verbeux). */
function slimReel(r: Reel) {
  return {
    url: r.url,
    author: r.author,
    caption: r.caption.slice(0, 240),
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    engagementRate: r.engagementRate,
    postedAt: r.postedAt,
    hashtags: r.hashtags.slice(0, 8),
  };
}

export const TOOLS: ToolDef[] = [
  {
    ...meta("youtube_ma_chaine"),
    description:
      "Statistiques LIVE de la chaîne YouTube connectée : abonnés, vues, vidéos récentes et analytics sur N jours. À utiliser pour tout bilan ou recommandation basé sur les vraies performances.",
    parameters: obj({ days: int("Période d'analyse en jours", 7, 90) }),
    run: async (a) => renderYouTubeForPrompt(await fetchYouTubeSnapshot({ days: Number(a.days ?? 30), videos: 10 })),
  },
  {
    ...meta("youtube_recherche"),
    description:
      "Recherche de vidéos YouTube publiques (hors de ma chaîne) avec vues, likes et commentaires. Pour la veille, l'inspiration et l'analyse de concurrents.",
    parameters: obj(
      {
        query: str("Requête de recherche"),
        order: { type: "string", enum: ["relevance", "viewCount", "date"], description: "Tri des résultats" },
        publishedWithinDays: int("Uniquement les vidéos publiées depuis N jours", 1, 365),
        maxResults: int("Nombre de résultats", 1, 15),
      },
      ["query"]
    ),
    run: (a) =>
      searchPublicVideos({
        query: String(a.query),
        order: a.order as "relevance" | "viewCount" | "date" | undefined,
        publishedWithinDays: a.publishedWithinDays ? Number(a.publishedWithinDays) : undefined,
        maxResults: a.maxResults ? Number(a.maxResults) : undefined,
      }),
  },
  {
    ...meta("instagram_reels_hashtag"),
    description:
      "Reels Instagram récents d'un ou plusieurs hashtags, classés par vues, avec taux d'engagement. Pour détecter ce qui marche en ce moment dans une niche. Prend 30 à 90 secondes.",
    parameters: obj(
      {
        hashtags: strList("Hashtags sans le #, ex. [\"skincare\", \"routinebeaute\"]"),
        maxAgeDays: int("Uniquement les reels publiés depuis N jours", 1, 60),
        limit: int("Nombre max de reels par hashtag", 5, 30),
      },
      ["hashtags"]
    ),
    run: async (a) =>
      (await hashtagReels(a.hashtags as string[], { limit: Number(a.limit ?? 15), maxAgeDays: a.maxAgeDays ? Number(a.maxAgeDays) : undefined }))
        .slice(0, 20)
        .map(slimReel),
  },
  {
    ...meta("instagram_reels_createurs"),
    description:
      "Reels récents de comptes Instagram précis (concurrents, créateurs, prospects), classés par vues. Prend 30 à 90 secondes.",
    parameters: obj(
      {
        usernames: strList("Noms de comptes sans @"),
        maxAgeDays: int("Uniquement les reels publiés depuis N jours", 1, 90),
        limit: int("Nombre max de reels par compte", 3, 20),
      },
      ["usernames"]
    ),
    run: async (a) =>
      (await creatorReels(a.usernames as string[], { limit: Number(a.limit ?? 10), maxAgeDays: a.maxAgeDays ? Number(a.maxAgeDays) : undefined }))
        .slice(0, 20)
        .map(slimReel),
  },
  {
    ...meta("tiktok_tendances"),
    description:
      "Vidéos TikTok populaires pour des hashtags ou des recherches : vues, likes, partages, son utilisé, taux d'engagement. Pour la veille tendances et l'inspiration. Prend 30 à 120 secondes.",
    parameters: obj({
      hashtags: strList("Hashtags sans le #"),
      searchQueries: strList("Recherches libres"),
      resultsPerQuery: int("Résultats par hashtag/recherche", 3, 20),
    }),
    run: async (a) =>
      (
        await tiktokTrends({
          hashtags: a.hashtags as string[] | undefined,
          searchQueries: a.searchQueries as string[] | undefined,
          resultsPerQuery: a.resultsPerQuery ? Number(a.resultsPerQuery) : undefined,
        })
      ).slice(0, 25),
  },
  {
    ...meta("gmail_boite"),
    description: "Derniers emails reçus sur la boîte Gmail connectée (expéditeur, objet, date, aperçu).",
    parameters: obj({ max: int("Nombre d'emails", 1, 25) }),
    run: async (a) =>
      (await fetchGmailInbox(Number(a.max ?? 15))).map((m) => ({
        id: m.id,
        from: `${m.from} <${m.fromEmail}>`,
        subject: m.subject,
        receivedAt: m.receivedAt,
        preview: m.preview.slice(0, 220),
      })),
  },
  {
    ...meta("gmail_envoyer"),
    description:
      "Envoie un email depuis la boîte Gmail connectée. L'utilisateur doit approuver l'envoi dans le chat : rédige l'email complet et final avant d'appeler cet outil.",
    parameters: obj(
      {
        to: str("Adresse du destinataire"),
        subject: str("Objet"),
        body: str("Corps de l'email en texte brut, signé"),
      },
      ["to", "subject", "body"]
    ),
    run: async (a) => {
      const to = String(a.to).trim();
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) throw new Error(`Adresse invalide : ${to}`);
      const r = await sendEmail({ to, subject: String(a.subject), body: String(a.body) });
      return { envoyé: true, à: to, messageId: r.messageId, sentAt: r.sentAt };
    },
  },
  {
    ...meta("drive_fichiers"),
    description: "Fichiers récents du Google Drive connecté (nom, type, date, lien).",
    parameters: obj({ max: int("Nombre de fichiers", 5, 30) }),
    run: async (a) => renderDriveForPrompt(await fetchRecentDriveFiles(Number(a.max ?? 15))),
  },
  {
    ...meta("fireflies_calls"),
    description: "Derniers calls enregistrés par Fireflies : résumé, points clés, actions, participants.",
    parameters: obj({ max: int("Nombre de calls", 1, 10) }),
    run: async (a) => {
      if (!isFirefliesConfigured()) throw new Error("Fireflies n'est pas connecté (FIREFLIES_API_KEY absente).");
      return (await fetchFirefliesMeetings(Number(a.max ?? 5))).map((m) => ({
        title: m.title,
        date: m.date,
        durationMin: m.durationMin,
        participants: m.participants,
        summary: m.summary,
        keyPoints: m.keyPoints,
        actionItems: m.actionItems,
      }));
    },
  },
  {
    ...meta("linkedin_publier"),
    description:
      "Publie un post texte public sur le profil LinkedIn connecté. L'utilisateur doit approuver dans le chat : passe le texte FINAL, prêt à publier (3 000 caractères max, sauts de ligne et hashtags inclus).",
    parameters: obj({ text: str("Texte intégral du post") }, ["text"]),
    run: async (a) => {
      const r = await publishLinkedInPost(String(a.text));
      return { publié: true, url: r.url };
    },
  },
  {
    ...meta("instagram_publier"),
    description:
      "Publie une image ou un Reel sur le compte Instagram professionnel connecté. L'utilisateur doit approuver dans le chat. Le média doit être une URL https publique (ou un chemin /… d'une image générée par la plateforme). Légende finale, hashtags inclus, 2 200 caractères max.",
    parameters: obj(
      {
        media_url: str("URL https publique de l'image (JPEG) ou de la vidéo (MP4) à publier"),
        media_type: { type: "string", enum: ["IMAGE", "REELS"], description: "IMAGE pour une photo, REELS pour une vidéo" },
        caption: str("Légende complète du post"),
      },
      ["media_url", "media_type", "caption"]
    ),
    run: async (a) => {
      const r = await publishInstagram({
        mediaUrl: String(a.media_url),
        mediaType: a.media_type === "REELS" ? "REELS" : "IMAGE",
        caption: String(a.caption),
      });
      return { publié: true, url: r.permalink ?? "https://www.instagram.com/" };
    },
  },
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** Outils autorisés par agent (slug) : chaque agent ne voit que ceux de son rôle. */
export const AGENT_TOOLS: Record<string, string[]> = {
  fireflies: ["fireflies_calls", "gmail_boite", "drive_fichiers"],
  prospection: ["gmail_boite", "gmail_envoyer", "instagram_reels_createurs", "drive_fichiers"],
  proposition: ["fireflies_calls", "gmail_boite", "gmail_envoyer", "drive_fichiers"],
  "createur-contenu": ["linkedin_publier", "instagram_publier", "youtube_ma_chaine", "youtube_recherche", "instagram_reels_hashtag", "tiktok_tendances", "drive_fichiers"],
  veille: ["instagram_reels_hashtag", "instagram_reels_createurs", "tiktok_tendances", "youtube_recherche"],
  ecommerce: ["linkedin_publier", "instagram_publier", "instagram_reels_hashtag", "tiktok_tendances", "youtube_recherche"],
};
