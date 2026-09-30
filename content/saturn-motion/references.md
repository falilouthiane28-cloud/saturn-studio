# Références motion design du propriétaire (30/09/2026)

Quatre vidéos envoyées comme modèles (WhatsApp, 848×480, 17 à 28 s ; les 2-3 dernières secondes sont l'écran de fin TikTok, à ignorer).

| vidéo | durée utile | coupes | enchaînement |
|---|---|---|---|
| Hera (karlozyx) | ~18 s | 1 | accroche tapée au curseur sur dégradé chaud → champ de saisie qui s'écrit → enregistreur vocal sur fond sombre → vague rouge plein écran → puces de style → logo sur aplat rouge |
| dnyxstudios | ~21 s | 4 | icônes 3D une par une sur gris clair → texte cinétique avec un mot en couleur → iPhone qui tourne → cartes pastel → logo Notion → nom de marque flou sur noir |
| Claude | ~25 s | 1 | « Discover Claude » (mot accentué) → champ de saisie → interface en perspective 3D sous verre sombre → liste « Progress 1/4 » en zoom → pastilles produits |
| Claude.ai (Notespace) | ~15 s | 3 | scène 3D sombre, cubes lumineux, dock d'icônes → dégradé rose-orangé et texte → carte sombre à bord lumineux, clic de curseur → logo avec halo |

## Grammaire retenue
1. Peu de coupes (1 à 4 en 20 s), mouvements de caméra continus.
2. Fonds : blanc, gris clair, noir, dégradés doux, et une couleur de marque qui envahit l'écran.
3. L'interface du produit est la star : saisie, écrans en 3D, curseur, puces, listes.
4. Un mot accentué en couleur de marque dans chaque texte.
5. Toujours une révélation du logo à la fin.

## Ce qui en a été tiré dans l'app
- Styles : clean-explainer, lancement-saas, produit-3d, degrade-doux (lib/instagram/motion.ts).
- Templates : Démo produit (20 s), Découverte (25 s), Révélation de marque (15 s) (lib/instagram/motionTemplates.ts).
- Scènes UI et LOGO ; mot accentué `*mot*` ; format 9:16 ou 16:9.
- Images Higgsfield sans texte ; titres, mot accentué et logo rendus par Chromium et posés au montage (integrations/titresMotion.ts, montageMotion.ts).
- Limite : la saisie « tapée » lettre par lettre et le curseur animé ne sont pas encore animés au montage (titres en fondu).
