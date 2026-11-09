// Wallet-free browser smoke test for the actual GardenBotMobileBattle React
// component. Run against local Vite DEV only; never sends Sui transactions.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const sizes = [
  { name: "320x568", width: 320, height: 568, portrait: true },
  { name: "375x667", width: 375, height: 667, portrait: true },
  { name: "390x844", width: 390, height: 844, portrait: true },
  { name: "414x896", width: 414, height: 896, portrait: true },
  { name: "640x360-landscape", width: 640, height: 360, portrait: false },
];
const output = "mobile-screenshots";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const report = [];
let failed = false;
try {
  for (const size of sizes) {
    const page = await browser.newPage({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    try {
      const response = await page.goto("http://127.0.0.1:4173/mobile-preview.html", { waitUntil: "networkidle", timeout: 20000 });
      if (!response?.ok()) throw new Error("Preview route HTTP " + response?.status());
      const stage = page.locator('[data-testid="garden-bot-mobile-stage"]');
      await stage.waitFor({ state: "visible", timeout: 10000 });
      const cards = page.locator(".gbm-move");
      const count = await cards.count();
      if (count !== 4) throw new Error("Expected four playable cards; found " + count);
      const metrics = await page.evaluate(() => {
        const stage = document.querySelector(".gbm-stage");
        const buttons = [...document.querySelectorAll(".gbm-move")];
        const s = stage?.getBoundingClientRect();
        const rects = buttons.map(el => {
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) };
        });
        return {
          bodyWidth: document.documentElement.scrollWidth,
          bodyHeight: document.documentElement.scrollHeight,
          stageHeight: stage?.clientHeight,
          stageScrollHeight: stage?.scrollHeight,
          stageBounds: s ? { top: Math.round(s.top), bottom: Math.round(s.bottom) } : null,
          cards: rects,
          imgCount: document.querySelectorAll(".gbm-image-box img").length,
          screenshotWidth: window.innerWidth,
        };
      });
      if (errors.length) throw new Error("Browser errors: " + errors.join("; "));
      if (metrics.bodyWidth > size.width + 1) throw new Error("Horizontal overflow " + metrics.bodyWidth + " > " + size.width);
      if (metrics.cards.some(c => c.height < 44 || c.width < 44)) throw new Error("Card touch target below 44 px");
      if (metrics.imgCount !== 2) throw new Error("Missing player or bot artwork");
      if (size.portrait && (metrics.stageScrollHeight - metrics.stageHeight > 2)) {
        throw new Error("Stage needs vertical scroll at portrait " + size.name + ": " + metrics.stageScrollHeight + " vs " + metrics.stageHeight);
      }
      if (size.portrait && metrics.cards.some(c => c.bottom > size.height + 1)) {
        throw new Error("Playable cards fall below visible portrait viewport");
      }
      await page.screenshot({ path: path.join(output, size.name + ".png"), fullPage: false });
      await cards.first().click();
      const newScore = await page.locator(".gbm-player .gbm-fighter-heading strong").innerText();
      if (newScore.trim() !== "40/50") throw new Error("Simulated move failed to update UI; score: " + newScore);
      report.push({ viewport: size.name, status: "PASS", metrics });
    } catch (e) {
      failed = true;
      await page.screenshot({ path: path.join(output, size.name + "-error.png"), fullPage: true }).catch(() => {});
      report.push({ viewport: size.name, status: "FAIL", reason: String(e), errors });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;
