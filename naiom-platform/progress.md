# Journal d'avancement — Saturn Studio

## 📍 Où on en est (30 sept. 2026)
- **En ligne** : https://209-74-71-111.sslip.io (VPS Spaceship, Docker, Caddy HTTPS, page /login).
- **Fait** : 6 agents avec connecteurs ; **Léa renommée Fatou** ; 14 modèles visuels avec la mascotte **Orbi** (scènes IA Higgsfield) ; téléchargement PDF + ZIP des vraies images ; **Nina** appelée sur les posts techniques ; **montage vidéo étape 1** (rendu sur le PC) ; **pack Instagram** branché sur Fatou (brouillon seulement, 47 tests).
- **En attente de l'utilisateur** : brief 3 (Nina + pack Instagram) ; Client ID/Secret LinkedIn ; URI Google dans Google Cloud ; Instagram (compte Facebook verrouillé par Meta).
- **Prochaine étape** : brief 3 Nina (retirer ses outils Apify de scraping Instagram, brancher ig-viral / ig-audit / ig-plan / ig-profile), puis étapes 2-3 du montage vidéo.

## Pack Instagram sur Fatou (29-30 sept. 2026) ✅
- ✅ Pack `instagram-agent-skill` (MIT, commit `d03c56b`, voir `agents/skills/instagram/UPSTREAM.txt`) : 13 skills **copiés à l'octet** (`.gitattributes` `* -text`), calibrage français dans `_saturn/` (`hooks.fr.json`, `slop.fr.json`).
- ✅ Couche commune `src/lib/instagram/` : scripts Python lancés par `execFile` (liste blanche), portages TS vérifiés par tests « golden » contre le Python, routeur de capacités, état (`IG_STATE_DIR`, `log.md` en ajout seul et seulement après « oui »), garde brouillon-seulement, enveloppe de relais Nina → Fatou.
- ✅ Fatou : prompt système IG verbatim dans `.claude/agents/createur-contenu.md`, 13 outils IA, chiffres inventés remplacés par `{{your number}}`, légende passée par ig-human + caption_lint (lien = échec). Vérifié en prod.
- ✅ Outils de publication retirés de Fatou (`linkedin_publier`, `instagram_publier`, `instagram_reels_hashtag`) ; `web_fetch` bloque instagram.com / facebook.com pour Fatou et Nina.
- ✅ Garde corrigée après 2 faux positifs en prod : ne refuse que les vraies DEMANDES (« publie ça », « à ma place »), pas les mots dans un contenu à rédiger.
- Tests : `node --test src/lib/instagram/tests/` (47 ✅, en local ; Node 24 requis).

## Montage vidéo — étape 1 (28-29 sept. 2026) ✅
- ✅ Studio vidéo : l'utilisateur envoie vidéo + voix (pas de voix off générée), envoi **par morceaux de 8 Mo avec reprise** (connexion lente : les envois d'un bloc tombaient en 408).
- ✅ **Poste de montage sur le PC** : `C:\Users\fallo\dev\video-studio` (Remotion), lancer `demarrer.bat`. Il interroge le serveur (`VIDEO_WORKER_TOKEN`), monte, renvoie le rendu. Montage interrompu → repris au redémarrage.
- ✅ Testé de bout en bout (6 vidéos, empreintes MD5 identiques). Étapes 2-3 : pas encore demandées.

## 14 modèles + mascotte Orbi + scènes IA (27-28 sept. 2026) ✅
- ✅ **Orbi** : drone en porcelaine blanche, œil-anneau de Saturne violet, **sans jambes (il flotte)**. Références `orbi-base.png` + `orbi-wave.png`, contrôle qualité par vision Claude (2 reprises max).
- ✅ 14 directions (`src/lib/content/directions.ts`) dont 4 « Scènes Orbi » générées par Higgsfield (format 3:4, le 4:5 est refusé). Script anti-chevauchement du texte.
- ✅ Téléchargement **PDF + ZIP** construits à partir des PNG réellement rendus (avant : illustrations absentes).
- ✅ Nina (`src/lib/content/nina.ts`) : brief de veille ajouté aux posts jugés techniques.

## Logo sur toutes les créations (27 sept. 2026) ✅
- ✅ Logo officiel (`public/brand/saturn-logo-{black,white}.png`, fond transparent) : dans la mise en page des carrousels Poster/Éditorial, decks PDF (pied de page) et visuels hybrides ; apposé sur les images IA (Higgsfield, Gemini, Creative Studio) et les miniatures YouTube (bas droite). Noir ou blanc choisi selon le fond.
- ✅ Module unique `src/lib/brand/logo.ts` (`logoDataUri`, `stampLogo`, `stampRemoteImage`, `stampLocalFile`). Vérifié en prod.

## Visuels Higgsfield + fiabilité du chat (27 sept. 2026) ✅
- ✅ **Visuels héros via Higgsfield** (API REST, `HIGGSFIELD_API_KEY` « id:secret », modèle Soul 720p) ; Gemini en repli. Testé en prod : carrousel de 4 slides avec 3 visuels en ~60 s.
- ✅ Le **fond de la slide suit celui du visuel** (luminosité des coins mesurée) et les bords du visuel sont en fondu radial : plus de rectangle visible.
- ✅ **Bug corrigé (tous les agents)** : Fatou affirmait « fichier enregistré dans content/… » sans l'écrire (consigne de sa fiche pensée pour Claude Code) → le carrousel était perdu. Le prompt du chat interdit désormais d'annoncer un fichier et impose le livrable complet dans la réponse.
- ✅ Vérifié en prod : la direction artistique « Poster » de Fatou est bien chargée dans le conteneur.
- ✅ **« Higgsfield non connecté » corrigé** : le Creative Studio et les visuels de posts utilisaient le CLI Higgsfield (absent du conteneur). Réécrits sur l'API REST (`lib/integrations/higgsfield.ts`, mêmes fonctions) ; édition d'après les miniatures `public/templates` avec `alibaba/qwen-image-3/edit` (le modèle `nano_banana_pro` n'existe pas dans l'API). Testé : visuel « 5 skills à installer sur Claude » généré au style du template Type 2.

## Style visuel de Fatou + decks PDF (26 sept. 2026) ✅
- ✅ **Carrousels « Poster »** (défaut) : titres massifs Anton, un mot en accent (`**mot**`) ou en pastille (`==mot==`), visuel héros Gemini par slide (`> visuel:`), noir/blanc + violet, alternance sombre/clair, mot fantôme, repères de recadrage, grain. Sans Gemini : motifs graphiques de repli (bandes tramées, sphère + orbite, cadres de sélection). Sélecteur Poster / Éditorial dans le Studio.
- ✅ **Decks PDF** : même langage par défaut (`theme: "classic"` pour l'ancien). Slides d'affirmation sombres, slides de données claires. Sans grain ni masques → PDF léger (≈ 260 Ko pour 4 slides au lieu de 7,4 Mo) et texte sélectionnable.
- ✅ Direction artistique écrite dans `.claude/agents/createur-contenu.md` ; planche de référence dans `clients/votre-marque/references/lea-poster-violet.jpg`.
- ⚠️ **Gemini** : clé installée (serveur + local), modèle `gemini-3.1-flash-image`, clé envoyée en en-tête. Génération d'images refusée (« quota 0 ») tant que la **facturation** n'est pas activée sur le projet Google (aistudio.google.com).

## Correctifs production (26 sept. 2026) ✅
- ✅ **Chromium** installé dans l'image Docker (`PUPPETEER_EXECUTABLE_PATH`) : carrousels, téléchargements de posts, miniatures YouTube et factures ne fonctionnaient pas en prod.
- ✅ **Médias générés** servis en prod par `src/app/media/[dir]/[...file]` (réécriture dans `next.config.ts`) et conservés entre déploiements (volumes Docker `saturn_gen_*`). Dossiers ignorés par git.
- ✅ **Swap 2 Go** sur le VPS (RAM 2 Go saturée pendant les builds : 24 min → 28 s).

## Publication sur les réseaux (26 sept. 2026) — étape 2 en cours
- ✅ **LinkedIn** : OAuth (state anti-CSRF), outil `linkedin_publier` (Fatou, Emma) sur approbation, bouton « Connecter LinkedIn ». Chemin « Approuver » testé (échec propre sans connexion). 🔜 En attente du Client ID / Secret de l'utilisateur.
- ✅ **Instagram** : « Instagram API with Instagram Login » (pas de Page Facebook), outil `instagram_publier` (image ou Reel) sur approbation, jeton 60 j prolongé automatiquement. 🔜 Bloqué : le compte Facebook de l'utilisateur est verrouillé par Meta (appareil non reconnu). Alternative proposée : hub de publication (Ayrshare, Buffer, PostEverywhere).
- 🔜 TikTok et X : non commencés (TikTok = Content Posting API ; X = API payante ; ou hub).

## Connecteurs des agents (26 sept. 2026) — étape 1 ✅
- ✅ Couche d'outils côté serveur (`src/lib/tools/`), permissions par agent, journal des appels.
- ✅ Outils : YouTube (ma chaîne, recherche), Instagram (reels par hashtag / par compte, via Apify), TikTok (tendances via Apify), Gmail (boîte, **envoi sur approbation**), Drive, Fireflies.
- ✅ Carte d'approbation dans le chat pour toute action d'écriture ; testé : refus → email jamais envoyé (vérifié dans le journal).
- ✅ Testé sur comptes réels : Fatou (vrais chiffres YouTube), Nina (top TikTok #skincareroutine, 42 s).
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
