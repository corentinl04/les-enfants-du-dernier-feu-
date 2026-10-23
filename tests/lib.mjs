// Outils communs aux tests : lancement de Chromium headless sur une COPIE locale du jeu (file://), collecte des erreurs.
// Aucun test ne publie ni n'écrit dans le fichier testé.
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
export const { chromium } = require('playwright');

export async function ouvrir(browser, fichier, { initStorage = null, cpu = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (initStorage) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('__init')) { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('__init', '1'); } }, initStorage);
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
  await page.goto('file://' + fichier);
  await page.waitForFunction(() => window.EDF && !document.getElementById('title').hidden, null, { timeout: 30000 });
  return { ctx, page, erreurs };
}

// Erreurs JS de la page + erreurs capturées par le jeu lui-même (Game.errors)
export async function erreursJeu(page, erreurs) {
  const internes = await page.evaluate(() => EDF.Game.errors.slice()).catch(() => ['page inaccessible']);
  return [...new Set([...erreurs, ...internes])];
}

export const pause = (page, ms) => page.waitForTimeout(ms);

// Commandes simulées au clavier (ce n'est PAS une session de jeu humaine)
export async function agiter(page, secondes, { soigner = false } = {}) {
  const touches = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
  const fin = Date.now() + secondes * 1000;
  let i = 0;
  while (Date.now() < fin) {
    const k = touches[i++ % 4];
    await page.keyboard.down(k);
    await page.keyboard.press('KeyJ');
    await pause(page, 180);
    if (i % 3 === 0) await page.keyboard.press('Space');
    await page.keyboard.up(k);
    if (soigner) await page.evaluate(() => { const p = EDF.W.player; if (p && !p.dead) p.hp = Math.max(p.hp, p.hpMax || p.hp); });
  }
}
