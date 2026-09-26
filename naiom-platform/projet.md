# Saturn Studio — Projet

**Marque :** Saturn Studio (ex-NAIOM) · Propriétaire : Fallou Thiane · depuis sept. 2026.
Le dossier disque garde le nom historique `naiom-platform` **volontairement** (pour que les pages Installer/Héberger affichent des chemins exacts).

## Stack
- **Next.js 16.2.4** (Turbopack) · **React 19** · **TypeScript** · **Tailwind v4**
- Polices : Instrument Serif (noms d'agents / titres display), Inter + Archivo (UI) via `next/font/google`.
- **Thème clair par défaut** (sombre uniquement sur choix explicite, bouton soleil/lune).
- Accent unique : **violet** (`--color-primary` : `#6D28D9` clair / `#A78BFA` sombre), défini dans `theme.css`. Jamais de hex en dur.

## Emplacement (IMPORTANT)
- **Vrai projet, copie de travail :** `C:\Users\fallo\dev\naiom-platform`
- À côté : `C:\Users\fallo\dev\.claude\agents\` (les 6 définitions d'agents) + dossiers de livrables (`content/`, `meetings/`, `propositions/`, `analytics/`, `clients/`).
- `PATHS.agents` résout vers `<parent de l'app>/.claude/agents` → l'app doit rester un **enfant direct** de cette racine.
- ⚠️ Les dossiers dans `C:\Users\fallo\Documents\AGENTS AI CLAUDE\<Agent>\...` sont des **copies périmées** (version buggée à 14 agents). Ne pas les lancer : elles ré-affichent les agents fantômes. Voir `progress.md`.

## Les 6 agents (source unique de vérité)
Définis dans `src/lib/agents.ts` → `const AGENTS`. **Un agent n'existe que s'il a son module `.claude/agents/<slug>.md`.**

| slug | prénom | rôle |
|------|--------|------|
| `fireflies` | Fallou (chef d'équipe) | Analyste de calls |
| `prospection` | Awa | Agent prospection |
| `proposition` | Basse | Proposition commerciale |
| `createur-contenu` | Léa | Créateur de contenu |
| `veille` | Nina | Veille tendances |
| `ecommerce` | Emma | Agente e-commerce |

`AGENT_SLUGS` et `AGENT_COUNT` en **dérivent** : ne jamais réécrire une liste de slugs ni un compte en dur. Le badge « X employés IA » suit `team.length` / `agents.length` partout (landing, `/#equipe`, dashboard).

Chef d'équipe : **Fallou** (`fireflies`), déclaré dans `agentsUI.ts` (module sans `fs`), pas dans `agents.ts` (qui importe `node:fs` et casserait le bundle client).

## Lancer l'app
```bash
cd /c/Users/fallo/dev/naiom-platform
npm run dev            # http://localhost:3000
```
En cas de 500 Turbopack (`Can't resolve '@vercel/turbopack-next/internal/font/google/font'`) : purger le cache puis relancer **un seul** serveur.
```bash
rm -rf .next node_modules/.cache && npm run dev
```

## Pièges connus
- **Icônes** : `Icon` lit un registre statique `src/components/iconRegistry.ts` (pas toute la lib Lucide). Nouvelle icône → l'ajouter au registre, sinon cercle de repli + avertissement en dev. lucide-react v1.8 n'a plus d'icônes de marque (`Instagram`, `Youtube`…).
- **`images.localPatterns`** dans `next.config.ts` est une liste blanche : tout nouveau dossier sous `public/` doit y être ajouté sinon `next/image` répond 400.
- **Turbopack en dev** : 500/ReferenceError fantômes après beaucoup d'éditions ou après un `rm -rf .next` partiel → purger `.next` + `node_modules/.cache`, un seul serveur, onglet navigateur neuf.
- **`.env.local` : une seule ligne par clé.** Une 2e ligne `ANTHROPIC_API_KEY` (ex. collage d'une commande contenant une clé masquée « •••• ») écrase la vraie → erreur « Cannot convert argument to a ByteString ».
- **Serveur de dev lancé depuis Claude Code** : retirer `ANTHROPIC_BASE_URL` de l'environnement (`env -u ANTHROPIC_BASE_URL npm run dev`).
- **Ne jamais importer `@/lib/agents` depuis un composant client** (charge `node:fs`). Passer par `agentsUI.ts`.
- Un `transform` CSS sur un conteneur de page casse la nav `position: fixed`.

## Assets mascottes
Images sources : `C:\Users\fallo\Documents\AGENTS AI CLAUDE\img\mascotte *.jpeg` — lues par `scripts/build_avatars.py` (`SRC` codé en dur). **Ne pas supprimer ce dossier `img/`.** Recadrage à la source, jamais en CSS (ratios hétérogènes).

## Architecture ajoutée (sept. 2026)
- **Accès** : `src/proxy.ts` (Next 16 : ex-middleware) + page `/login` + session en cookie signé HMAC 30 j (`src/lib/auth/session.ts`). Mot de passe = `SATURN_ACCESS_PASSWORD` ; absent (dev local) → accès ouvert. Accueil `/` public, tout le reste (y compris `/api/*`) protégé. Déconnexion : `LogoutButton` (POST).
- **Connecteurs des agents** : `src/lib/tools/` — `registry.ts` (outils + `AGENT_TOOLS` par agent), `meta.ts` (libellés, importable côté client), `agentTools.ts` (conversion AI SDK, journal `analytics/tools/tool-calls.jsonl`). Branchés dans `api/chat/route.ts`. Outils `kind: "write"` → `needsApproval` : carte « Approuver / Refuser » dans le chat (`components/chat/ToolActivity.tsx`). Aucun repli sur des données de démo.
- **Navigation** : `SiteFooter` unique (landing `full` / app `compact`), `MobileTabBar` (≤ 768 px) montée hors des en-têtes (un `backdrop-filter` piège le `position: fixed`), sélecteur des 6 agents sur la fiche agent.

## Production
- VPS Spaceship `209.74.71.111`, SSH port **22022**. App dans `/srv/saturn` (clone du repo GitHub privé `falilouthiane28-cloud/saturn-studio`), conteneur Docker lié à `127.0.0.1:3000`.
- **https://209-74-71-111.sslip.io** via Caddy (Let's Encrypt automatique). Pare-feu ufw : 22022, 80, 443.
- Déployer : `cd /srv/saturn && git pull && docker compose up -d --build`.
- Secrets uniquement dans `/srv/saturn/naiom-platform/.env.local` sur le serveur (jamais dans le repo).
