import type { CalendarSlot } from "@/lib/types";

/**
 * Calendrier éditorial — vide par défaut.
 *
 * Ce fichier contenait le planning de lancement d'une autre structure, avec
 * des noms d'auteurs et de produits qui n'appartiennent pas à Saturn Studio.
 * Tout a été retiré : la grille démarre vide et se remplit avec les
 * publications réellement programmées depuis le Studio (cf. `extraSlots`).
 */
export const CALENDAR_WEEK: CalendarSlot[] = [];

export const CHANNELS: CalendarSlot["channel"][] = [
  "LinkedIn",
  "Instagram",
  "YouTube",
  "Email",
];

/**
 * Jours de la semaine en cours, calculés au chargement.
 * Les dates étaient auparavant figées en avril 2026 : la grille affichait donc
 * une semaine passée quelle que soit la date du jour.
 */
function currentWeekDays(): string[] {
  const today = new Date();
  // Lundi de la semaine courante (getDay : 0 = dimanche, d'où le +6 % 7).
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const label = d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    // « lun. 20 avr. » → « Lun. 20 avr. »
    return label.charAt(0).toUpperCase() + label.slice(1);
  });
}

export const DAYS = currentWeekDays();
