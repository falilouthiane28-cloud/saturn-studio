/**
 * Store de l'agent prospection (Awa) — le pipeline IAcquisition™.
 * Persisté dans Supabase (table live_data, clé "prospection_leads").
 */

import { readLiveData, writeLiveData } from "@/lib/supabase/liveStore";

const SOURCE = "prospection_leads";

export type LeadStatus = "detecte" | "enrichi" | "pret" | "contacte";

export interface Lead {
  id: string;
  name: string;
  niche: string;
  ville: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  rating?: number;
  reviewsCount?: number;
  emails?: string[];
  emailVerified?: boolean;
  socials?: string[];
  insights?: string;
  status: LeadStatus;
  outreach?: {
    subject: string;
    email: string;
    linkedin: string;
    generatedAt: string;
  };
  createdAt: string;
  enrichedAt?: string;
  contactedAt?: string;
}

export async function readLeads(): Promise<Lead[]> {
  const result = await readLiveData<{ leads: Lead[] }>(SOURCE);
  return result?.data?.leads ?? [];
}

async function writeLeads(leads: Lead[]): Promise<void> {
  await writeLiveData(SOURCE, { leads });
}

let writeLock: Promise<unknown> = Promise.resolve();
function mutate<T>(fn: (leads: Lead[]) => { leads: Lead[]; result: T } | Promise<{ leads: Lead[]; result: T }>): Promise<T> {
  const run = writeLock.then(async () => {
    const current = await readLeads();
    const { leads, result } = await fn(current);
    await writeLeads(leads);
    return result;
  });
  writeLock = run.catch(() => undefined);
  return run;
}

export async function addLeads(newLeads: Lead[]): Promise<Lead[]> {
  return mutate((leads) => {
    const seen = new Set(leads.map((l) => `${l.name.toLowerCase()}::${l.ville.toLowerCase()}`));
    const fresh = newLeads.filter(
      (l) => !seen.has(`${l.name.toLowerCase()}::${l.ville.toLowerCase()}`)
    );
    return { leads: [...fresh, ...leads], result: fresh };
  });
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<Lead | null> {
  return mutate((leads) => {
    const i = leads.findIndex((l) => l.id === id);
    if (i < 0) return { leads, result: null };
    leads[i] = { ...leads[i], ...patch };
    return { leads, result: leads[i] };
  });
}

export async function deleteLead(id: string): Promise<boolean> {
  return mutate((leads) => {
    const next = leads.filter((l) => l.id !== id);
    return { leads: next, result: next.length < leads.length };
  });
}
