"""Pipeline images agents — mascottes 3D Saturn Studio.

Produit, pour chaque agent, quatre declinaisons WebP :

  <slug>-avatar-{256,512}.webp   carre centre sur le visage      -> cercles
  <slug>-banner-{640,1280}.webp  16:10 COMPOSE (fond floute)     -> cartes studio
  <slug>-portrait-640.webp       3:4 buste                       -> fiche agent
  <slug>-figure-{640,960}.webp   tuile 4:5 composee, figurine entiere -> hero

Pourquoi une banniere COMPOSEE et non recadree :
les mascottes sont des figurines plein corps, verticales, sur un decor.
Tailler un 16:10 dedans coupe forcement le personnage (c'est le bug des
visages rognes). On fabrique donc le cadre : le decor de l'image, agrandi
et floute, sert de fond ; la figurine entiere est posee dessus, ajustee en
hauteur. Rien n'est jamais coupe.
"""
from PIL import Image, ImageFilter
import os, json

SRC = r"C:\Users\fallo\Documents\AGENTS AI CLAUDE\img"
DST = r"C:\Users\fallo\dev\naiom-platform\public\agents"
os.makedirs(DST, exist_ok=True)

# cx, cy = point focal en fraction de l'image, pour la banniere et le portrait.
# Le cadrage de l'avatar, lui, n'est PAS devine : il est derive de la boite
# englobante reelle de la figurine (cf. head_box).
AGENTS = [
    dict(slug="ecommerce",        name="Emma",    file="mascoote emma 3d.jpeg",   cx=0.50, cy=0.31, hy=0.24),
    dict(slug="createur-contenu", name="Léa",     file="mascotte lea 3d.jpeg",    cx=0.50, cy=0.30),
    dict(slug="veille",           name="Nina",    file="mascotte 3d nina.jpeg",   cx=0.50, cy=0.28),
    dict(slug="prospection",      name="Awa",     file="mascotte sacha 3 d.jpeg", cx=0.50, cy=0.33, hy=0.30),
    dict(slug="fireflies",        name="Fallou", file="mascotte jule 3d.jpeg",   cx=0.50, cy=0.28),
    dict(slug="proposition",      name="Basse",  file="mascotte victor 3d.jpeg", cx=0.50, cy=0.28),
]


def crop_box(W, H, cx, cy, side):
    """Carre centre sur (cx,cy), recale dans l'image sans jamais sortir du cadre."""
    side = min(side, W, H)
    l = cx * W - side / 2
    t = cy * H - side / 2
    l = max(0, min(l, W - side))
    t = max(0, min(t, H - side))
    return (int(l), int(t), int(l + side), int(t + side))


def aspect_box(W, H, cx, cy, ratio):
    """Plus grand rectangle du ratio donne, centre sur le point focal."""
    if W / H > ratio:
        h = H
        w = h * ratio
    else:
        w = W
        h = w / ratio
    l = max(0, min(cx * W - w / 2, W - w))
    t = max(0, min(cy * H - h / 2, H - h))
    return (int(l), int(t), int(l + w), int(t + h))


def compose_banner(im, cx, cy, out_w, ratio=16 / 10):
    """Banniere ratio fixe : decor floute en fond + figurine ENTIERE par-dessus.

    La figurine est ajustee en hauteur avec une marge, donc jamais coupee,
    quel que soit le ratio de l'image source. Le fond est un degrade tire des
    bords du decor, et la figurine y est posee en fondu : aucune couture.
    """
    out_h = int(out_w / ratio)
    W, H = im.size

    # Fond : degrade vertical tire des bords du decor (6 % de chaque cote),
    # jamais de l'image entiere agrandie — sinon un fantome geant du
    # personnage apparait derriere lui. Chaque ligne du fond prend la couleur
    # moyenne du ciel a la meme hauteur dans la source : le fondu de la
    # figurine tombe donc sur la bonne teinte.
    fig_h = int(out_h * 0.92)
    sw = max(2, int(W * 0.06))
    edges = Image.new("RGB", (sw * 2, H))
    edges.paste(im.crop((0, 0, sw, H)), (0, 0))
    edges.paste(im.crop((W - sw, 0, W, H)), (sw, 0))
    column = edges.resize((1, fig_h), Image.BOX)
    bg = Image.new("RGB", (out_w, out_h), column.getpixel((0, 0)))
    bg.paste(column.resize((out_w, fig_h), Image.NEAREST), (0, out_h - fig_h))
    bg = bg.filter(ImageFilter.GaussianBlur(max(8, out_h // 40)))

    # Figurine : ajustee en hauteur, 92 % du cadre, centree horizontalement.
    fig_w = int(W * (fig_h / H))
    fig = im.resize((max(1, fig_w), fig_h), Image.LANCZOS)
    # Pose en fondu : sans masque, les bords de l'image source se lisent comme
    # un rectangle net au milieu du decor floute. Le fondu (bords gauche,
    # droit et haut) fond la figurine dans son propre decor, qui est le meme.
    bg.paste(fig, ((out_w - fig.width) // 2, out_h - fig_h), feather_mask(fig.size))
    return bg


def feather_mask(size, side=0.16, top=0.10):
    """Masque L : opaque au centre, fondu lisse (smoothstep) vers les bords."""
    w, h = size
    fx, fy = max(1, int(w * side)), max(1, int(h * top))

    def ramp(d, span):
        t = min(1.0, d / span)
        return t * t * (3 - 2 * t)

    col = [ramp(min(x, w - 1 - x), fx) for x in range(w)]
    row = [ramp(y, fy) for y in range(h)]
    m = Image.new("L", (w, h))
    m.putdata([int(255 * c * r) for r in row for c in col])
    return m


def figure_box(im, thresh=26):
    """Boite englobante approximative de la figurine.

    ATTENTION a la limite de cette heuristique : elle compare chaque bord a la
    couleur du coin haut-gauche et ne rogne que des marges QUASI UNIFORMES.
    Les decors de ces mascottes sont des degrades de ciel : sur la plupart des
    images elle ne rogne donc rien et renvoie le cadre entier. C'est voulu et
    sans danger — un cadre entier reste un point de depart correct pour
    head_box, qui raisonne en proportions du corps.
    """
    g = im.convert("L")
    W, H = g.size
    px = g.load()
    ref = px[0, 0]

    def row_flat(y):
        return all(abs(px[x, y] - ref) < thresh for x in range(0, W, max(1, W // 60)))

    def col_flat(x):
        return all(abs(px[x, y] - ref) < thresh for y in range(0, H, max(1, H // 60)))

    top = 0
    while top < H - 1 and row_flat(top):
        top += 1
    bot = H - 1
    while bot > top + 1 and row_flat(bot):
        bot -= 1
    left = 0
    while left < W - 1 and col_flat(left):
        left += 1
    right = W - 1
    while right > left + 1 and col_flat(right):
        right -= 1
    return (left, top, right + 1, bot + 1)


def head_box(im, fig_box, hy=0.26):
    """Carre tete + epaules, derive de la boite englobante de la figurine.

    Les six mascottes partagent la meme morphologie chibi : tete surdimensionnee
    occupant grosso modo le tiers superieur du corps. On cadre donc tete +
    epaules (55 % de la hauteur du corps, centre a 26 %) plutot que le visage
    seul : dans un cercle de 40 px ca reste lisible, et surtout ca fonctionne
    pour Fallou, dont le casque est un aplat noir sans traits — un cadrage
    serre sur son "visage" ne donnerait qu'un rond noir.
    """
    l, t, r, b = fig_box
    fh = b - t
    side = fh * 0.55
    ccx = (l + r) / 2
    ccy = t + fh * hy
    W, H = im.size
    side = min(side, W, H)
    x = max(0, min(ccx - side / 2, W - side))
    y = max(0, min(ccy - side / 2, H - side))
    return (int(x), int(y), int(x + side), int(y + side))


manifest = {}
total_before = total_after = 0

for a in AGENTS:
    p = os.path.join(SRC, a["file"])
    if not os.path.exists(p):
        raise SystemExit(f"INTROUVABLE : {p}")
    total_before += os.path.getsize(p)
    im = Image.open(p).convert("RGB")
    W, H = im.size

    # Boite de la figurine : base de tous les cadrages derives.
    fbox = figure_box(im)

    # 1) Avatar carre — tete + epaules, derive de fbox (jamais devine)
    sq = im.crop(head_box(im, fbox, a.get("hy", 0.26)))
    for size in (512, 256):
        out = os.path.join(DST, f"{a['slug']}-avatar-{size}.webp")
        sq.resize((size, size), Image.LANCZOS).save(out, "WEBP", quality=88, method=6)
        total_after += os.path.getsize(out)

    # 2) Banniere composee — figurine entiere, jamais coupee
    for w in (1280, 640):
        out = os.path.join(DST, f"{a['slug']}-banner-{w}.webp")
        compose_banner(im, a["cx"], a["cy"], w).save(out, "WEBP", quality=82, method=6)
        total_after += os.path.getsize(out)

    # 3) Portrait 3:4 (colonne gauche de la fiche agent)
    pt = im.crop(aspect_box(W, H, a["cx"], a["cy"], 3 / 4))
    out = os.path.join(DST, f"{a['slug']}-portrait-640.webp")
    pt.resize((640, int(640 * 4 / 3)), Image.LANCZOS).save(out, "WEBP", quality=85, method=6)
    total_after += os.path.getsize(out)

    # 4) Tuile hero 4:5 — meme composition que la banniere, format portrait.
    #    La figurine tient entiere ; le decor floute remplit le cadre. Pas de
    #    detourage : segmenter un sujet sombre sur un ciel sombre sans modele
    #    dedie donnerait des bords sales.
    for w in (960, 640):
        out = os.path.join(DST, f"{a['slug']}-figure-{w}.webp")
        compose_banner(im, a["cx"], a["cy"], w, ratio=4 / 5).save(
            out, "WEBP", quality=86, method=6
        )
        total_after += os.path.getsize(out)

    manifest[a["slug"]] = dict(
        name=a["name"],
        source=a["file"],
        focalX=round(a["cx"] * 100),
        focalY=round(a["cy"] * 100),
    )
    print(f"{a['name']:8s} {W}x{H} -> avatar/banner/portrait/figure OK")

with open(os.path.join(DST, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f"\nAvant : {total_before/1024/1024:.1f} Mo (6 JPEG source)")
print(f"Apres : {total_after/1024/1024:.1f} Mo (42 WebP, toutes tailles)")
