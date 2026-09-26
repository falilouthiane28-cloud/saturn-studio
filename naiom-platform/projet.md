# Saturn Studio — Projet

**Marque :** Saturn Studio (ex-NAIOM) · Propriétaire : Fallou Thiane · depuis sept. 2026.
Le dossier disque garde le nom historique `naiom-platform` **volontairement** (pour que les pages Installer/Héberger affichent des chemins exacts).

## Stack
- **Next.js 16.2.4** (Turbopack) · **React 19** · **TypeScript** · **Tailwind v4**
- Polices : Instrument Serif (noms d'agents / titres display), Inter + Archivo (UI) via `next/font/google`.
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
- **lucide-react v1.8** n'a plus d'icônes de marque (`Instagram`, `Linkedin`, `Youtube`, `Chrome`) → `Icon` retombe sur un cercle générique sans erreur. Vérifier `name in Lucide`. Reste à corriger : `src/app/install/page.tsx` (`Apify`, `Fireflies`).
- **`images.localPatterns`** dans `next.config.ts` est une liste blanche : tout nouveau dossier sous `public/` doit y être ajouté sinon `next/image` répond 400.
- **Turbopack en dev** : 500/ReferenceError fantômes après beaucoup d'éditions ou après un `rm -rf .next` partiel → purger `.next` + `node_modules/.cache`, un seul serveur, onglet navigateur neuf.
- **`ANTHROPIC_API_KEY` dans `.env.local` = placeholder 17 caractères** (une vraie clé ≈ 100). L'UI tourne, mais chat + orchestration renvoient une erreur tant qu'elle n'est pas remplacée par `sk-ant-...`.
- **Ne jamais importer `@/lib/agents` depuis un composant client** (charge `node:fs`). Passer par `agentsUI.ts`.
- Un `transform` CSS sur un conteneur de page casse la nav `position: fixed`.

## Assets mascottes
Images sources : `C:\Users\fallo\Documents\AGENTS AI CLAUDE\img\mascotte *.jpeg` — lues par `scripts/build_avatars.py` (`SRC` codé en dur). **Ne pas supprimer ce dossier `img/`.** Recadrage à la source, jamais en CSS (ratios hétérogènes).
