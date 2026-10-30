# MISSION: Add WhatsApp Outreach to AWA (Prospecting Agent) — Without Breaking Anything

You are a senior full-stack engineer working inside `saturn-studio/naiom-platform` (Next.js 16 App Router, React 19, TypeScript, Supabase available). Your mission is to give **AWA**, our AI prospecting agent, the ability to **compose and send a personalized WhatsApp message to a lead**, as a new channel alongside the existing Gmail email channel.

This is a **surgical, additive change**. The existing prospecting pipeline (Detect → Enrich → Personalize → Contact) works in production. You must extend it, never rewrite it.

---

## 0. CONTEXT YOU MUST READ FIRST (before writing any code)

Read and understand these files completely. Do not skip this step.

- `src/app/api/prospection/contact/route.ts` — current email send step (Prêt → Contacté)
- `src/app/api/prospection/personalize/route.ts` — how `lead.outreach` is generated
- `src/app/api/prospection/enrich/route.ts` — how contact data (emails, phones?) is found
- `src/app/api/prospection/leads/route.ts`
- `src/lib/prospection/store.ts` — `readLeads`, `updateLead`, the `Lead` type
- `src/lib/integrations/gmailSend.ts` and `src/lib/integrations/google.ts` — the integration pattern to mirror
- `src/app/settings/page.tsx` — where integrations ("Connexions") are configured
- `src/app/agents/[slug]/page.tsx` — AWA's UI
- `package.json`, `.env.example` (or equivalent), `DEPLOY.md`

Then write a short **Recon Report** (max 25 lines): Lead type shape, where phone numbers are (or aren't) stored, the integration pattern, the UI entry point for "Contact", and any risk you see. **Do not modify any file until the Recon Report is done.**

---

## 1. NON-NEGOTIABLE RULES

### R1 — Do not break existing behavior
- The email flow (`POST /api/prospection/contact` with `{ leadId, to? }`) must behave **exactly** as today. Its request/response contract is frozen.
- Never rename, delete, or change the signature of existing exports, types, routes, or DB fields.
- All changes to shared types are **additive and optional** (e.g. `phones?: string[]`, `whatsapp?: {...}`). Existing stored leads must still parse.
- Lead status values stay compatible: reuse `"contacte"`; if you need a channel marker, add an optional field (`contactChannel?: "email" | "whatsapp"`), do not invent a new status unless it's purely additive and handled everywhere it's read.

### R2 — Isolation
- All WhatsApp logic lives in new files:
  - `src/lib/integrations/whatsapp.ts` (provider client + status)
  - `src/lib/prospection/whatsappMessage.ts` (message composition / formatting)
  - `src/lib/prospection/phone.ts` (E.164 normalization & validation)
  - `src/app/api/prospection/contact-whatsapp/route.ts` (new endpoint)
- Touch existing files only to (a) add optional type fields, (b) add the UI button/channel selector, (c) add the settings connection card. Every edit to an existing file must be minimal and listed in the final report.

### R3 — Provider & secrets
- Default provider: **WhatsApp Cloud API (Meta Graph API)** via plain `fetch` — no new heavy SDK unless justified.
- Design `whatsapp.ts` behind a small interface (`sendWhatsAppText`, `sendWhatsAppTemplate`, `getWhatsAppStatus`) so Twilio could be swapped in later.
- Env vars only, never hardcoded, never logged, never sent to the client: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_API_VERSION` (default `v21.0`), `WHATSAPP_DEFAULT_TEMPLATE` (optional). Add them to `.env.example` with comments.
- If not configured, `getWhatsAppStatus()` returns `{ connected: false }` and the route returns **412** with a French message: `"WhatsApp non connecté — configurez-le dans Connexions."` (mirror Gmail behavior).

### R4 — WhatsApp platform compliance (critical)
- Business-initiated cold outreach **must use an approved message template** (outside the 24h customer-service window). Free-form text is only allowed if the lead messaged us within the last 24h.
- Implement both paths: `template` (default for cold prospects, with personalized variables `{{1}}`, `{{2}}`…) and `text` (only when a 24h window is known open). Never silently fall back from template to free text.
- Respect opt-out: if a lead has `whatsappOptOut: true` or replied STOP, refuse with **409**.
- No bulk blasting: the endpoint sends to **one lead per request**. Add a simple in-memory/DB rate guard (e.g. max N sends/minute, configurable) and refuse duplicate sends to the same lead within 24h unless `force: true`.

### R5 — Message quality (AWA's voice)
- WhatsApp message ≠ email. Compose a **short** version: max ~600 characters, no subject line, 1 clear call-to-action, natural tone, French by default (match lead's language if known), at most 1 emoji, no links shorteners, no ALL CAPS.
- Derive it from `lead.outreach` (existing personalization) — do not regenerate from scratch if a good source exists. Store result in `lead.outreach.whatsapp` (optional field) so the user can preview/edit before sending.
- Human-in-the-loop: the UI shows the composed message in an editable textarea; sending requires an explicit click. AWA never auto-sends without confirmation unless a future explicit setting enables it (not in scope).

### R6 — Phone numbers
- Normalize to E.164 (default country **SN / +221** when no prefix). Validate length and digits. Reject landlines/invalid with 422 and a clear French error.
- Accept `to` override in the body (same pattern as email).
- If enrich doesn't collect phones yet, add **optional** extraction of phone numbers into `lead.phones?: string[]` without altering existing enrich output fields.

### R7 — Errors & observability
- Same response shape as the email route: `{ success: true, lead, sentTo, messageId }` or `{ error: string }` with proper status codes (404, 409, 412, 422, 429, 500, 502 for provider errors).
- Map Meta error codes to readable French messages (invalid number, template not approved, token expired, rate limit, recipient not on WhatsApp).
- Log with prefix `[prospection/contact-whatsapp]`, never log tokens or full phone numbers (mask: `+22177****12`).
- Persist `lead.whatsapp = { messageId, sentAt, to, mode: "template" | "text", templateName? }`.

### R8 — Code standards
- Strict TypeScript, no `any`, no `@ts-ignore`. `export const runtime = "nodejs"`.
- Follow existing file style (comments in French as in the codebase, header JSDoc describing the route).
- No new dependency without written justification in the final report.

### R9 — Proof, not claims
- `npm run build` and `npx tsc --noEmit` must pass. Run lint if configured.
- You may not say "done" without showing the command outputs.

---

## 2. SUB-AGENTS (execute in order, each with a clear handoff)

Run each sub-agent as a focused phase. Each one ends with a **handoff note** (files touched, decisions, open risks). A later agent may not start until the previous handoff is written.

### 🔍 Agent 1 — RECON (read-only)
**Goal:** Map the codebase. **Allowed:** read files only.
**Output:** Recon Report (see §0) + list of exact files to create/modify + regression risk list.

### 🏗️ Agent 2 — ARCHITECT (no code yet)
**Goal:** Produce the design.
**Output:**
- Type additions (exact TS diff for `Lead`)
- `whatsapp.ts` interface signatures
- Route contract: `POST /api/prospection/contact-whatsapp` body `{ leadId: string; to?: string; mode?: "template" | "text"; message?: string; templateName?: string; force?: boolean }`
- Sequence diagram (text) of the flow
- UI change plan (channel selector Email | WhatsApp on the Contact step, preview/edit, send button, status badge)
**Gate:** confirm every rule R1–R8 is respected by the design.

### 🔌 Agent 3 — INTEGRATION ENGINEER
**Goal:** Build `src/lib/integrations/whatsapp.ts` + `src/lib/prospection/phone.ts`.
- `getWhatsAppStatus()`, `sendWhatsAppTemplate({ to, templateName, language, variables })`, `sendWhatsAppText({ to, body })`
- Timeout (15s via `AbortController`), 1 retry on 5xx/network only, never on 4xx.
- Error mapping table for Meta codes.
- Unit-testable pure functions (normalization, masking, error mapping).

### ✍️ Agent 4 — MESSAGE COMPOSER (AWA's voice)
**Goal:** Build `src/lib/prospection/whatsappMessage.ts`.
- `composeWhatsAppMessage(lead): { text: string; templateVariables: string[] }`
- Reuse the existing LLM/personalization path if present; otherwise deterministic condensation of `lead.outreach.email`.
- Enforce R5 constraints programmatically (length cap, single CTA, emoji count, strip subject/signature blocks).
- Optionally extend `personalize` route to also fill `outreach.whatsapp` — **additively**, behind existing output.

### 🛣️ Agent 5 — API ENGINEER
**Goal:** Build `src/app/api/prospection/contact-whatsapp/route.ts`.
Order of checks: parse body → lead exists (404) → outreach exists (422) → opt-out (409) → WhatsApp connected (412) → recipient normalized (422) → duplicate/rate guard (409/429) → send → `updateLead` with `status: "contacte"`, `contactedAt`, `contactChannel: "whatsapp"`, `whatsapp: {...}` → respond.
Do **not** modify `contact/route.ts`.

### 🎨 Agent 6 — UI ENGINEER
**Goal:** Minimal UI integration in AWA's prospecting interface + Settings.
- Contact step: channel toggle (Email default, WhatsApp), editable message preview, phone field (prefilled from `lead.phones[0]`), send button with loading/disabled states, success/error toast using existing UI components.
- Settings → Connexions: a WhatsApp card showing connected/not connected (from a `GET` status endpoint that never exposes secrets).
- Lead card: small badge showing contact channel.
- Match existing design system; no new UI library.

### 🛡️ Agent 7 — QA & REGRESSION GUARD
**Goal:** Prove nothing broke.
- Run `npx tsc --noEmit`, `npm run build`, lint.
- Add tests if a test runner exists (phone normalization, composer constraints, error mapping, route guards with mocked fetch). If none exists, add a small `scripts/test-whatsapp.ts` dry-run that runs without hitting Meta (`WHATSAPP_DRY_RUN=true` → returns fake messageId).
- Regression checklist: email contact route unchanged (diff = 0), old leads without new fields load in UI, settings page renders with and without WhatsApp env vars.
- Review full `git diff` against rules R1–R9; any violation → send back to the responsible agent.

### 📝 Agent 8 — DOCUMENTATION
- Update `DEPLOY.md` with: Meta Business setup steps, creating & getting a template approved (provide a suggested French template text with variables), env vars, dry-run mode, test procedure.
- Final report.

---

## 3. DEFINITION OF DONE

- [ ] AWA can generate a WhatsApp-specific message for a lead, the user can edit it and send it in one click.
- [ ] Cold outreach uses an approved template; free text only within 24h window.
- [ ] Email flow is byte-for-byte unchanged in behavior.
- [ ] Missing config → clean 412, UI shows "connect WhatsApp" hint, nothing crashes.
- [ ] Opt-out, duplicate and rate guards work.
- [ ] No secrets in client bundle or logs; phone numbers masked in logs.
- [ ] `tsc`, `build`, lint pass — outputs shown.
- [ ] `DEPLOY.md` updated; `.env.example` updated.

---

## 4. FINAL REPORT FORMAT

1. **Summary** (3 lines)
2. **Files created** (path + one-line purpose)
3. **Files modified** (path + exact reason + why it's safe)
4. **New env vars**
5. **Verification outputs** (tsc / build / lint / tests)
6. **Manual test steps** (dry-run, then real send to a test number)
7. **Known limitations & next steps** (e.g. inbound webhook for replies/STOP, delivery status callbacks, Supabase migration of the lead store)

If at any point a requirement conflicts with existing code or is ambiguous, **stop and ask** with a precise question and your recommended option — never guess on anything that could break production.
