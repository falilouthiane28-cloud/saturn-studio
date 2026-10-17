import { MOCK_INBOX, type MockEmail } from "@/data/mockInbox";
import { MOCK_MEETINGS, type MockMeeting } from "@/data/mockMeetings";
import {
  MOCK_CANDIDATES,
  MOCK_JOBS,
  type MockCandidate,
  type MockJobPosting,
} from "@/data/mockCandidates";
import { isFirefliesConfigured, fetchFirefliesMeetings } from "@/lib/integrations/fireflies";
import { loadTokens } from "@/lib/integrations/google";
import { fetchYouTubeSnapshot } from "@/lib/integrations/youtube";
import { fetchGmailInbox } from "@/lib/integrations/gmail";
import { fetchRecentDriveFiles } from "@/lib/integrations/drive";
import { readLiveData, writeLiveData } from "@/lib/supabase/liveStore";

/**
 * Layer de données Saturn Studio.
 *
 * Chaque source lit en priorité la table Supabase `live_data` alimentée par
 * les routes de sync ou l'auto-refresh. Si pas de données live, fallback sur
 * le mock embarqué — la plateforme reste démo-able sans connexion externe.
 */

export const LIVE_SOURCES = {
  inbox: "inbox",
  meetings: "meetings",
  candidates: "candidates",
  youtube: "youtube",
  drive: "drive",
} as const;

export type LiveSource = keyof typeof LIVE_SOURCES;

export interface SourceResult<T> {
  data: T;
  live: boolean;
  lastUpdated?: string;
}

async function readLiveOrFallback<T>(source: string, fallback: T): Promise<SourceResult<T>> {
  const result = await readLiveData<T>(source);
  if (result) {
    return { data: result.data, live: true, lastUpdated: result.updatedAt };
  }
  return { data: fallback, live: false };
}

// ---- Auto-refresh en arrière-plan ----
const refreshInFlight = new Set<string>();

function scheduleRefresh<T>(
  source: string,
  ttlMinutes: number,
  fetchFn: () => Promise<T>,
  label: string
): void {
  if (refreshInFlight.has(source)) return;
  (async () => {
    try {
      const existing = await readLiveData(source);
      if (existing) {
        const ageMin = (Date.now() - new Date(existing.updatedAt).getTime()) / 60000;
        if (ageMin < ttlMinutes) return;
      }
      refreshInFlight.add(source);
      const data = await fetchFn();
      await writeLiveData(source, data);
      console.log(`[auto-refresh] ${label} mis à jour (TTL ${ttlMinutes}min)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[auto-refresh] ${label} : ${msg.slice(0, 120)}`);
    } finally {
      refreshInFlight.delete(source);
    }
  })();
}

async function getCachedOrFetch<T>(
  source: string,
  ttlMinutes: number,
  fetchFn: () => Promise<T>
): Promise<{ data: T; lastUpdated: string }> {
  const existing = await readLiveData<T>(source);
  if (existing) {
    const ageMin = (Date.now() - new Date(existing.updatedAt).getTime()) / 60000;
    if (ageMin < ttlMinutes) {
      return { data: existing.data, lastUpdated: existing.updatedAt };
    }
  }
  const data = await fetchFn();
  try { await writeLiveData(source, data); } catch { /* */ }
  return { data, lastUpdated: new Date().toISOString() };
}

async function hasGoogleTokens(): Promise<boolean> {
  const t = await loadTokens();
  return !!t;
}

export async function getInbox(): Promise<SourceResult<MockEmail[]>> {
  if (await hasGoogleTokens()) {
    try {
      const { data, lastUpdated } = await getCachedOrFetch(LIVE_SOURCES.inbox, 15, () => fetchGmailInbox(20));
      return { data, live: true, lastUpdated };
    } catch (err) {
      console.warn(`[Gmail] ${err instanceof Error ? err.message : err}`);
      return { data: [], live: true, lastUpdated: new Date().toISOString() };
    }
  }
  return { data: MOCK_INBOX, live: false, lastUpdated: new Date().toISOString() };
}

export async function getMeetings(): Promise<SourceResult<MockMeeting[]>> {
  if (process.env.FIREFLIES_MOCK === "1") {
    return { data: MOCK_MEETINGS, live: true, lastUpdated: new Date().toISOString() };
  }
  if (isFirefliesConfigured()) {
    try {
      const { data, lastUpdated } = await getCachedOrFetch(LIVE_SOURCES.meetings, 30, () => fetchFirefliesMeetings(20));
      return { data, live: true, lastUpdated };
    } catch (err) {
      console.warn(`[Fireflies] ${err instanceof Error ? err.message : err}`);
      return { data: [], live: true, lastUpdated: new Date().toISOString() };
    }
  }
  return { data: MOCK_MEETINGS, live: false, lastUpdated: new Date().toISOString() };
}

export async function getCandidates(): Promise<SourceResult<{ candidates: MockCandidate[]; jobs: MockJobPosting[] }>> {
  return readLiveOrFallback(LIVE_SOURCES.candidates, { candidates: MOCK_CANDIDATES, jobs: MOCK_JOBS });
}

export async function getYouTubeSnapshot(): Promise<{ live: boolean; lastUpdated?: string; data?: unknown }> {
  if (await hasGoogleTokens()) {
    scheduleRefresh(
      LIVE_SOURCES.youtube,
      60,
      () => fetchYouTubeSnapshot({ days: 30, videos: 20 }),
      "YouTube"
    );
  }
  const result = await readLiveData(LIVE_SOURCES.youtube);
  if (result) {
    return { live: true, lastUpdated: result.updatedAt, data: result.data };
  }
  return { live: false };
}

export async function renderYouTube(): Promise<string> {
  const snap = await getYouTubeSnapshot();
  if (!snap.live || !snap.data) return "";
  const { renderYouTubeForPrompt } = await import("@/lib/integrations/youtube");
  return renderYouTubeForPrompt(snap.data as Parameters<typeof renderYouTubeForPrompt>[0]);
}

export async function getDriveSnapshot(): Promise<{ live: boolean; lastUpdated?: string; data?: unknown }> {
  if (await hasGoogleTokens()) {
    scheduleRefresh(LIVE_SOURCES.drive, 30, () => fetchRecentDriveFiles(30), "Drive");
  }
  const result = await readLiveData(LIVE_SOURCES.drive);
  if (result) {
    return { live: true, lastUpdated: result.updatedAt, data: result.data };
  }
  return { live: false };
}

export async function renderDrive(): Promise<string> {
  const snap = await getDriveSnapshot();
  if (!snap.live || !snap.data) return "";
  const { renderDriveForPrompt } = await import("@/lib/integrations/drive");
  return renderDriveForPrompt(snap.data as Parameters<typeof renderDriveForPrompt>[0]);
}

// ---- Rendus pour prompts agents ----

export async function renderInbox(): Promise<string> {
  const { data } = await getInbox();
  return data
    .map(
      (e) =>
        `### Email ${e.id} — ${e.urgency.toUpperCase()} ${e.requiresReply ? "[à répondre]" : ""}
- De : ${e.from} <${e.fromEmail}>
- Reçu : ${e.receivedAt}
- Sujet : ${e.subject}
- Catégorie : ${e.category}
- Corps : ${e.body}`
    )
    .join("\n\n");
}

export async function renderMeetings(): Promise<string> {
  const { data } = await getMeetings();
  return data
    .map(
      (m) =>
        `### Call ${m.id} — ${m.title}
- Date : ${m.date} (${m.durationMin} min)
- Type : ${m.type} · Sentiment : ${m.sentiment}
- Participants : ${m.participants.join(", ")}

**Résumé :** ${m.summary}

**Points clés :**
${m.keyPoints.map((k) => `  - ${k}`).join("\n")}

**Action items :**
${m.actionItems.map((a) => `  - ${a}`).join("\n")}

**Extrait :** ${m.transcript || "(pas d'extrait disponible)"}`
    )
    .join("\n\n");
}

export async function renderCandidatesFull(): Promise<string> {
  const { data } = await getCandidates();
  const jobsBlock = data.jobs
    .map(
      (j) =>
        `### Poste ${j.id} — ${j.title} (${j.seniority})
- Skills : ${j.skills.join(", ")}
- Localisation : ${j.location}
- Salaire : ${j.salaryRange}`
    )
    .join("\n\n");
  const candidatesBlock = data.candidates
    .map((c) => {
      const job = data.jobs.find((j) => j.id === c.appliedFor);
      return `### Candidat ${c.id} — ${c.fullName}
- Postule pour : ${job?.title ?? c.appliedFor}
- Reçu : ${c.receivedAt}
- XP : ${c.yearsXp} ans · Actuel : ${c.currentRole} @ ${c.currentCompany}
- Skills : ${c.skills.join(", ")}
- Forces : ${c.highlights.map((h) => `\n  - ${h}`).join("")}
- Réserves : ${c.redFlags.map((r) => `\n  - ${r}`).join("")}
- Prétention : ${c.salaryExpectation}
- Dispo : ${c.availability}
- Résumé : ${c.cvSummary}`;
    })
    .join("\n\n");
  return `## Postes ouverts\n\n${jobsBlock}\n\n## Candidats reçus\n\n${candidatesBlock}`;
}
