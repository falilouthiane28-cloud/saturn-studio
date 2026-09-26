# Mémoire projet — Saturn Studio

Règles et contexte persistants à respecter avant toute intervention.

## Règles dures
1. **Exactement 6 agents, partout.** Source unique : `const AGENTS` dans `src/lib/agents.ts`. Un agent n'existe **que** s'il a son fichier `.claude/agents/<slug>.md`. Ajouter une entrée sans le `.md` recrée le bug des agents « muets »/fantômes.
2. **Aucun compte ni liste de slugs en dur.** `AGENT_COUNT`/`AGENT_SLUGS` dérivent de `AGENTS`. Les badges « X employés IA » lisent `team.length` / `agents.length`.
3. **Accent unique = violet**, via le token `--color-primary*` (`theme.css`). Jamais de hex en dur, même dans les générateurs PDF/HTML autonomes.
4. **Langue : français.** Commentaires de code en français. Réponses en français.
5. **Proposer avant d'implémenter** les décisions structurantes ; demander plutôt que supposer quand un choix engage l'architecture.

## Emplacement de travail
- Vrai projet : `C:\Users\fallo\dev\naiom-platform` (écriture shell OK, hors `Documents`).
- Les copies dans `C:\Users\fallo\Documents\AGENTS AI CLAUDE\<Agent>\...` sont **périmées et buggées** (14 agents via `ACTIVE_SLUGS`). Ne pas les lancer, ne pas s'appuyer dessus.
- `Documents\AGENTS AI CLAUDE\img\` = **sources des mascottes**, à conserver (lu par `scripts/build_avatars.py`).
- Windows Defender : historiquement le shell ne pouvait pas écrire sous `Documents` ; le 22 sept. 2026 la **suppression** shell y a fonctionné (protection reconfigurée). Ne pas supposer l'écriture/création : tester sur un fichier jetable d'abord.

## Design / visuels
- Mascottes 3D plein corps (décor ciel dégradé), pas les anciennes photos portrait ni les Funko de `public/avatars/`.
- **Recadrer à la source, pas en CSS** (ratios très différents : Emma 0.56, Fallou 0.75, autres 1.00). Avatar = tête+épaules dérivé de la boîte englobante réelle ; bannière/figure = **dégradé tiré des bords du décor** + figurine entière posée **en fondu** (jamais l'image entière agrandie en fond : fantôme géant du personnage ; jamais découper une figurine). Vérifier sur planche-contact avant de livrer.
- Typo : Instrument Serif (display) + Inter/Archivo (UI).

## Pièges techniques (rappel)
- Turbopack : 500 fantômes → purge `.next` + `node_modules/.cache`, un seul serveur, onglet neuf.
- `next/font/google` peut casser après purge partielle → purge complète.
- `.env.local` : une seule ligne par clé (une clé masquée « •••• » collée en double casse le chat).
- Ne pas importer `@/lib/agents` côté client (utilise `node:fs`) → passer par `agentsUI.ts`.
- Icônes : registre statique `iconRegistry.ts` ; lucide v1.8 sans icônes de marque.
- `images.localPatterns` (next.config.ts) : liste blanche pour `next/image`.

- Thème **clair par défaut**. Le CSS de `theme.css` est hors couche : il l'emporte sur les utilitaires Tailwind (`md:hidden`…) → piloter l'affichage par media query.
- Derrière Caddy, `req.url` = `localhost:3000` → redirections **relatives** dans les routes.

## Sécurité (règles dures)
- Tout ce qui agit à l'extérieur (email, publication) passe par un outil `kind: "write"` → approbation de l'utilisateur. Jamais d'envoi automatique.
- Ne jamais exposer le port 3000 publiquement ni remettre un basic_auth Caddy (popup sur l'accueil à cause du prefetch).
- Aucune route sous `/api` exemptée d'authentification (livrables PDF privés).
- Vérifier l'absence de secrets dans chaque commit ; le repo GitHub reste **privé**.

## Chef d'équipe
Fallou (`fireflies`), déclaré dans `agentsUI.ts`.
