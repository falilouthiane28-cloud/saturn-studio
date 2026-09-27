# Journal d'avancement — Saturn Studio

## Visuels Higgsfield + fiabilité du chat (27 sept. 2026) ✅
- ✅ **Visuels héros via Higgsfield** (API REST, `HIGGSFIELD_API_KEY` « id:secret », modèle Soul 720p) ; Gemini en repli. Testé en prod : carrousel de 4 slides avec 3 visuels en ~60 s.
- ✅ Le **fond de la slide suit celui du visuel** (luminosité des coins mesurée) et les bords du visuel sont en fondu radial : plus de rectangle visible.
- ✅ **Bug corrigé (tous les agents)** : Léa affirmait « fichier enregistré dans content/… » sans l'écrire (consigne de sa fiche pensée pour Claude Code) → le carrousel était perdu. Le prompt du chat interdit désormais d'annoncer un fichier et impose le livrable complet dans la réponse.
- ✅ Vérifié en prod : la direction artistique « Poster » de Léa est bien chargée dans le conteneur.

## Style visuel de Léa + decks PDF (26 sept. 2026) ✅
- ✅ **Carrousels « Poster »** (défaut) : titres massifs Anton, un mot en accent (`**mot**`) ou en pastille (`==mot==`), visuel héros Gemini par slide (`> visuel:`), noir/blanc + violet, alternance sombre/clair, mot fantôme, repères de recadrage, grain. Sans Gemini : motifs graphiques de repli (bandes tramées, sphère + orbite, cadres de sélection). Sélecteur Poster / Éditorial dans le Studio.
- ✅ **Decks PDF** : même langage par défaut (`theme: "classic"` pour l'ancien). Slides d'affirmation sombres, slides de données claires. Sans grain ni masques → PDF léger (≈ 260 Ko pour 4 slides au lieu de 7,4 Mo) et texte sélectionnable.
- ✅ Direction artistique écrite dans `.claude/agents/createur-contenu.md` ; planche de référence dans `clients/votre-marque/references/lea-poster-violet.jpg`.
- ⚠️ **Gemini** : clé installée (serveur + local), modèle `gemini-3.1-flash-image`, clé envoyée en en-tête. Génération d'images refusée (« quota 0 ») tant que la **facturation** n'est pas activée sur le projet Google (aistudio.google.com).

## Correctifs production (26 sept. 2026) ✅
- ✅ **Chromium** installé dans l'image Docker (`PUPPETEER_EXECUTABLE_PATH`) : carrousels, téléchargements de posts, miniatures YouTube et factures ne fonctionnaient pas en prod.
- ✅ **Médias générés** servis en prod par `src/app/media/[dir]/[...file]` (réécriture dans `next.config.ts`) et conservés entre déploiements (volumes Docker `saturn_gen_*`). Dossiers ignorés par git.
- ✅ **Swap 2 Go** sur le VPS (RAM 2 Go saturée pendant les builds : 24 min → 28 s).

## Publication sur les réseaux (26 sept. 2026) — étape 2 en cours
- ✅ **LinkedIn** : OAuth (state anti-CSRF), outil `linkedin_publier` (Léa, Emma) sur approbation, bouton « Connecter LinkedIn ». Chemin « Approuver » testé (échec propre sans connexion). 🔜 En attente du Client ID / Secret de l'utilisateur.
- ✅ **Instagram** : « Instagram API with Instagram Login » (pas de Page Facebook), outil `instagram_publier` (image ou Reel) sur approbation, jeton 60 j prolongé automatiquement. 🔜 Bloqué : le compte Facebook de l'utilisateur est verrouillé par Meta (appareil non reconnu). Alternative proposée : hub de publication (Ayrshare, Buffer, PostEverywhere).
- 🔜 TikTok et X : non commencés (TikTok = Content Posting API ; X = API payante ; ou hub).

## Connecteurs des agents (26 sept. 2026) — étape 1 ✅
- ✅ Couche d'outils côté serveur (`src/lib/tools/`), permissions par agent, journal des appels.
- ✅ Outils : YouTube (ma chaîne, recherche), Instagram (reels par hashtag / par compte, via Apify), TikTok (tendances via Apify), Gmail (boîte, **envoi sur approbation**), Drive, Fireflies.
- ✅ Carte d'approbation dans le chat pour toute action d'écriture ; testé : refus → email jamais envoyé (vérifié dans le journal).
- ✅ Testé sur comptes réels : Léa (vrais chiffres YouTube), Nina (top TikTok #skincareroutine, 42 s).
- ⚠️ `TIKTOK_ACCESS_TOKEN` refusé par l'API officielle TikTok (`access_token_invalid`) → publication TikTok impossible en l'état.
- ➡️ Étape 2 (publication) : voir « Publication sur les réseaux » ci-dessus.

## Mise en ligne sécurisée (26 sept. 2026) ✅
- ✅ VPS Spaceship + Docker, **https://209-74-71-111.sslip.io** (Caddy + Let's Encrypt), port 3000 fermé, pare-feu ufw.
- ✅ Page de connexion de l'app (remplace l'authentification HTTP de Caddy, qui ouvrait une popup sur l'accueil à cause du prefetch). Anti force brute (5 essais / 15 min), redirections relatives, déconnexion.
- 🔜 Ajouter dans Google Cloud Console l'URI `https://209-74-71-111.sslip.io/api/integrations/google/callback`, puis reconnecter Google sur le serveur.
- 🔜 Nom de domaine propre (ex. acheté chez Spaceship) → une ligne à changer dans le Caddyfile.

## Refonte UI (25-26 sept. 2026) ✅
- ✅ Agents renommés : Ousmane → **Fallou**, Cheikh → **Basse** (UI, prompts, PDF, docs).
- ✅ Thème clair par défaut, fondu au basculement.
- ✅ Footer unique (`SiteFooter`), liens morts retirés ; logo officiel partout.
- ✅ Bannières des mascottes sans couture (dégradé du décor + figurine en fondu).
- ✅ Mobile : barre d'onglets en bas + feuille « Plus », sélecteur des 6 agents, cartes équipe lisibles en sombre.
- ✅ Emojis d'interface → icônes Lucide ; registre d'icônes (103 au lieu de toute la lib).
- ✅ Bugs corrigés : rotateur du hero vide, nav mobile hors écran, en-tête de fiche agent transparent.

## Refonte navigation / dashboard (22 sept. 2026)
- ✅ **Bug de chevauchement corrigé.** Avant : le Studio empilait DEUX couches de chrome — la pilule flottante `AppNav` (`fixed`, sur fond transparent) + une `TopBar` collante translucide. Au scroll, les bannières des cartes remontaient autour du logo et sous la TopBar → collision « très peu pro ».
- ✅ **Nouvelle Studio bar** (`.studio-bar` dans `theme.css`, `AppNav.tsx` réécrit) : UNE seule barre pleine largeur, collante EN FLUX, matériau translucide (blur + saturate, bord haut clair, fallbacks `prefers-reduced-transparency`/`-motion`). Logo à gauche, onglets défilables au centre (pilule violette active), actions globales (notifications, thème, réglages) à droite — jadis dans la TopBar, désormais cohérentes sur toutes les pages internes.
- ✅ `TopBar.tsx` retiré du dashboard ; statut (« N agents en ligne », emails urgents) replié dans l'en-tête de contenu. Spacers `h-[76px]` supprimés (calendrier, settings) car la barre est maintenant en flux.
- ✅ Vérifié en live : desktop + mobile (375px) + scroll + zéro erreur console. Le contenu passe proprement sous la barre, plus aucune collision.
- ℹ️ La landing garde sa pilule flottante (`LandingNav`) : la Studio bar est donc distincte du site vitrine, comme demandé.
- ✅ (traité depuis) contraste des avatars sombres, onglet actif mobile, micro-animations.

## État actuel (22 sept. 2026)
- ✅ **App propre et fonctionnelle** : `C:\Users\fallo\dev\naiom-platform`, servie sur **http://localhost:3000**.
- ✅ Rendu conforme à la cible : hero « Salut, on est Saturn Studio ! », **« 6 employés IA en ligne · 0 livrables »**, CTA « Entrer dans le studio », zéro erreur console.
- ✅ 6 agents partout (landing, `/#equipe`, dashboard, routes `/agents/<slug>`), compte dérivé de la vraie liste.
- ✅ (résolu depuis) vraie clé Anthropic en place, chat actif.

## Chronologie
1. **Signalement** : « retour des agents fantômes / 14 employés IA », hero cassé, erreur React.
2. **Audit** : le vrai projet `dev\naiom-platform` était **déjà propre** (6 agents, compte dérivé, hero OK, 0 erreur). Vérifié en live.
3. **Cause identifiée** : un serveur `next dev` tournait depuis une **copie périmée** dans `Documents\AGENTS AI CLAUDE\Emma-ecommerce\...\naiom-platform` — c'est cette version buggée (14 agents via `ACTIVE_SLUGS`) qui s'affichait, pas l'app dev.
4. **Nettoyage (autorisé)** : suppression des 6 copies périmées de `Documents` (~1,2 Go). Le serveur de la copie Emma a été arrêté au passage. `img/` et `supabase_schema.sql` conservés.
5. **Restauration par l'utilisateur** : les 6 dossiers d'agents ont été **remis** dans `Documents` (à nouveau la version buggée à 14 agents — à ne pas lancer).
6. **Remise en service** : redémarrage propre du serveur dev sur le port 3000. Un 500 Turbopack (`next/font/google` Archivo) est apparu après purge partielle de `.next` → **corrigé par purge complète** `.next` + `node_modules/.cache` et suppression des serveurs en double. Landing = 200, rendu conforme.

## Important à retenir
- **Rien n'a été détruit dans le vrai projet.** `dev\naiom-platform` et les 6 modules `.claude/agents/*.md` sont intacts depuis le début.
- Les dossiers de `Documents\AGENTS AI CLAUDE\<Agent>` sont des **doublons périmés** : les lancer réintroduit les agents fantômes. La version de référence est `dev\naiom-platform`.

## Prochaines étapes (suggestions)
- [x] Vraie clé Anthropic en place.
- [ ] Décider du sort des doublons `Documents` (les relancer = bug ; option : les supprimer à nouveau ou les ignorer). Une coquille vide `Emma-ecommerce\...\naiom-platform` d'un ancien nettoyage peut subsister, verrouillée par un handle OS — part au reboot.
- [ ] Corriger les icônes de marque manquantes dans `src/app/install/page.tsx` (`Apify`, `Fireflies`) — cf. piège lucide-react.
