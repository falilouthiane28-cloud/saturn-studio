/** Jeux d'essai partagés par les tests golden (anglais : comparés au Python d'origine). */
import fs from "node:fs";
import path from "node:path";
import { SKILLS_DIR } from "../python.ts";

const hooksJson = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, "ig-reel", "hooks.json"), "utf8")) as { hooks: { id: number; example: string }[] };

/** Les 26 exemples du pack + cas limites. */
export const HOOKS_EN: string[] = [
  ...hooksJson.hooks.map((h) => h.example),
  "I lost 40k in 3 months because I ignored one number",
  "Hey guys, welcome back to my channel",
  "In this video I'm going to show you how to grow",
  "Stop scrolling if you want more clients",
  "My first client paid me $18,000 for one landing page",
  "Twenty grand. That's what one missing clause cost me.",
  "You are wasting 4 hours a week on this",
  "Steal this script before your competitor does",
  "The truth about Instagram nobody tells you #growth",
  "This changed everything 🔥",
  "So basically there are a lot of things to consider when you start a business and want to grow it fast",
  "Grow.",
  "Sarah from Denver tripled her rate with one email",
  "Our agency fired its biggest client last week",
  "it is not about the views",
  "Why most creators quit at 1,000 followers",
  "What's up everyone, today we talk money",
  "Do this before you post your next reel",
  "Half of my revenue came from one old post",
  "Nobody warned me that 90% of reels flop",
];

/** Scripts de Reel (beats.py). */
export const SCRIPTS_EN: string[] = [
  "Most people quit at day three.\nHere is why.\nThe first week is fake progress.\nSo I tracked one thing.\nFollow for part two.",
  "I lost $18,000 on one missing clause.\nThe client said yes on a call.\nI never sent the contract.\nThree months later they walked.\nNow every yes gets a PDF within the hour.\nSteal the template, it is pinned.",
  "Hey everyone so today I want to talk about something really important that a lot of people ask me about all the time which is how to be consistent.",
];

/** Légendes (caption.py). */
export const CAPTIONS_EN: string[] = [
  "Stop guessing your hooks.\n\nI tested 26 formulas on 40 reels. Here is the one that won.\n\nSave this for your next script.\n\n#reels #hooks",
  "Link in bio! https://example.com\n\n#a #b #c #d #e #f",
  "In today's fast-paced world, it's important to note that consistency is key. Let's dive in.\n\nComment GUIDE and follow for more and save this.",
  "",
];

/** Textes pour humanize.py / detect.py. */
export const TEXTES_EN: string[] = [
  "In today's fast-paced world, it's important to note that consistency is key. Let's dive in — here's the thing: you need to leverage your content.",
  "I posted every day for 90 days. 61 of those reels did under 300 views. Then one did 212,000 and I still don't fully know why. Here's what I changed on day 47: I stopped writing the hook last. I wrote it first, said it out loud, and cut anything that took longer than two seconds. That's it. That's the whole trick, and it's boring.",
  "It's not just a tool, it's a revolution. Not only does it save time but also money.\n- Fast setup\n- Easy onboarding\n- Great support\nIn conclusion, this is a game-changer.",
  "Short.",
];
