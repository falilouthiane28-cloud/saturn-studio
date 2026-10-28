/**
 * Tests dry-run du canal WhatsApp — ne touche jamais l'API Meta.
 * Lancer : WHATSAPP_DRY_RUN=true node --test scripts/test-whatsapp.ts  (Node 24+)
 *
 * Couvre : normalisation E.164, masquage, contraintes du composer,
 * table de mapping d'erreurs Meta, et un envoi simulé.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizePhone, isValidPhone, maskPhone, PhoneError } from "../src/lib/prospection/phone.ts";
import { composeWhatsAppMessage } from "../src/lib/prospection/whatsappMessage.ts";
import { mapMetaError, getWhatsAppStatus, sendWhatsAppText } from "../src/lib/integrations/whatsapp.ts";

test("normalizePhone — formats variés vers E.164 (SN par défaut)", () => {
  assert.equal(normalizePhone("+221 77 123 45 67").e164, "+221771234567");
  assert.equal(normalizePhone("00221771234567").e164, "+221771234567");
  assert.equal(normalizePhone("0771234567").e164, "+221771234567");
  assert.equal(normalizePhone("771234567").e164, "+221771234567");
  assert.equal(normalizePhone("01 23 45 67 89", "FR").e164, "+33123456789");
});

test("normalizePhone — rejette l'invalide", () => {
  assert.throws(() => normalizePhone(""), PhoneError);
  assert.throws(() => normalizePhone("abc"), PhoneError);
  assert.throws(() => normalizePhone("12"), PhoneError);
  assert.equal(isValidPhone("pas un numéro"), false);
  assert.equal(isValidPhone("+221771234567"), true);
});

test("maskPhone — ne révèle jamais le numéro complet", () => {
  assert.equal(maskPhone("+221771234567"), "+22177****67");
  assert.ok(!maskPhone("+221771234567").includes("1234"));
});

test("composeWhatsAppMessage — contraintes R5", () => {
  const long = "OBJET BIDON. ".repeat(80);
  const c = composeWhatsAppMessage({
    name: "Boulangerie Dupont",
    ville: "Dakar",
    insights: "3 avis Google, pas de site",
    outreach: { email: `Bonjour, j'ai vu vos avis.\n\n${long}\n\nSeriez-vous ouvert à un audit ?\n\nCordialement\nFallou — Saturn Studio` },
  });
  assert.ok(c.text.length <= 600, "≤ 600 caractères");
  assert.ok(!/Cordialement|Saturn Studio/.test(c.text), "pas de signature");
  const emojis = (c.text.match(/\p{Extended_Pictographic}/gu) || []).length;
  assert.ok(emojis <= 1, "au plus 1 emoji");
  assert.equal(c.templateVariables.length, 2);
  assert.equal(c.templateVariables[0], "Boulangerie Dupont");
});

test("composeWhatsAppMessage — repli sans email", () => {
  const c = composeWhatsAppMessage({ name: "Garage X", ville: "Thiès" });
  assert.ok(c.text.includes("Garage X"));
  assert.ok(c.text.length > 0 && c.text.length <= 600);
});

test("mapMetaError — codes Meta vers statut HTTP + message FR", () => {
  assert.equal(mapMetaError(131047, "").status, 409); // hors fenêtre 24 h
  assert.equal(mapMetaError(132001, "").status, 422); // template non approuvé
  assert.equal(mapMetaError(190, "").status, 412); // jeton invalide
  assert.equal(mapMetaError(80007, "").status, 429); // rate limit
  assert.equal(mapMetaError(131026, "").status, 422); // pas sur WhatsApp
  assert.equal(mapMetaError(999999, "boom").status, 502); // inconnu
  assert.ok(/template/i.test(mapMetaError(132001, "").message));
});

test("dry-run — statut connecté et envoi simulé", async () => {
  process.env.WHATSAPP_DRY_RUN = "true";
  assert.equal(getWhatsAppStatus().connected, true);
  const r = await sendWhatsAppText({ to: "+221771234567", body: "test" });
  assert.ok(r.messageId.startsWith("dryrun-"), "messageId simulé");
  assert.ok(r.sentAt);
});
