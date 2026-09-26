/**
 * Métadonnées des outils, sans dépendance serveur : importables côté client
 * (affichage de l'activité et des approbations dans le chat).
 */
export type ToolKind = "read" | "write";
export type Platform = "youtube" | "instagram" | "tiktok" | "gmail" | "drive" | "fireflies" | "linkedin";

export const TOOL_META: Record<string, { platform: Platform; kind: ToolKind; label: string }> = {
  youtube_ma_chaine: { platform: "youtube", kind: "read", label: "Statistiques de ma chaîne YouTube" },
  youtube_recherche: { platform: "youtube", kind: "read", label: "Recherche de vidéos YouTube" },
  instagram_reels_hashtag: { platform: "instagram", kind: "read", label: "Reels Instagram par hashtag" },
  instagram_reels_createurs: { platform: "instagram", kind: "read", label: "Reels de comptes Instagram" },
  tiktok_tendances: { platform: "tiktok", kind: "read", label: "Tendances TikTok" },
  gmail_boite: { platform: "gmail", kind: "read", label: "Boîte Gmail" },
  gmail_envoyer: { platform: "gmail", kind: "write", label: "Envoyer un email" },
  drive_fichiers: { platform: "drive", kind: "read", label: "Fichiers Google Drive récents" },
  fireflies_calls: { platform: "fireflies", kind: "read", label: "Calls Fireflies" },
  linkedin_publier: { platform: "linkedin", kind: "write", label: "Publier sur LinkedIn" },
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  gmail: "Gmail",
  drive: "Google Drive",
  fireflies: "Fireflies",
  linkedin: "LinkedIn",
};
