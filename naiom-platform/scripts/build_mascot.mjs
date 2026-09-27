// Détoure les poses d'Orbi (générées sur fond noir) → PNG transparents recadrés.
// Remplissage depuis les bords : seul le noir CONNECTÉ à l'extérieur devient transparent,
// la visière noire (enfermée dans la coque blanche) reste opaque.
// Usage : node scripts/build_mascot.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = path.join(process.cwd(), "public", "brand", "mascot");
const THRESHOLD = 34; // canal max sous lequel un pixel compte comme « fond »

for (const f of fs.readdirSync(DIR).filter((x) => /^orbi-[a-z-]+\.png$/.test(x) && !x.endsWith("-cut.png"))) {
  const { data, info } = await sharp(path.join(DIR, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const bg = new Uint8Array(W * H);
  const isDark = (i) => Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) < THRESHOLD;
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const p = stack.pop();
    if (bg[p] || !isDark(p)) continue;
    bg[p] = 1;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W);
    if (y < H - 1) stack.push(p + W);
  }
  const mask = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = bg[i] ? 0 : 255;
  // Bord adouci pour éviter le liseré en escalier.
  const soft = await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).blur(1.2).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < W * H; i++) data[i * 4 + 3] = soft[i];
  const out = f.replace(".png", "-cut.png");
  await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .trim({ threshold: 1 })
    .resize({ height: 1000, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(path.join(DIR, out));
  console.log("✓", out);
}
