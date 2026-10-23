// Reproduction §19 : victoire → dialogues → récompenses → sortie → sanctuaire → sauvegarde → rechargement, avec rendu réel (boucle rAF du jeu).
import { chromium, ouvrir, pause } from './lib.mjs';
const [F, only] = process.argv.slice(2);
const PLAN = [['racine','foret','boss'],['chasseur','foret','chasseur'],['ossu','catacombes','boss'],['cendre','catacombes','cendrebrune'],['myco','fongique','boss'],['abbesse','fongique','abbesse'],['eteignoir','domaine','boss'],['engloutie','lac','boss'],['justine','lac','justine']].filter(p => !only || p[0] === only);
const browser = await chromium.launch();
for (const [bid, region, noeud] of PLAN) {
  const { ctx, page, erreurs } = await ouvrir(browser, F);
  await page.evaluate(() => { window.__toasts = []; new MutationObserver(() => { for (const t of document.querySelectorAll('#toasts .toast')) if (!t.__vu) { t.__vu = 1; window.__toasts.push(t.textContent); } }).observe(document.getElementById('toasts'), { childList: true, subtree: true }); });
  await page.evaluate(() => { EDF.newGame(1, { chevalier: 'T', secte: 'Q', classe: 'chevalier' }); EDF.setScene('sanctuaire', {}); });
  await pause(page, 800);
  await page.evaluate((r) => { EDF.UI.closeAll(); EDF.startExpedition(r); }, region);
  await pause(page, 1200);
  await page.evaluate((n) => { EDF.UI.closeAll(); const sc = EDF.Scenes.current, run = EDF.Game.state.run; if (n === 'justine') { sc.enterJustine(); return; } run.layers[run.couche][run.choix] = { type: n }; sc.loadNode(); }, noeud);
  await pause(page, 3500);
  // défaite du boss (serviteurs d'abord)
  for (let k = 0; k < 60; k++) {
    const fini = await page.evaluate(() => { const b = EDF.W.boss; if (!b || b.dead) return true; for (const o of EDF.W.enemies) if (!o.isBoss && !o.dead) EDF.damageEnemy(o, 9999, 0, 0, 0, {}); EDF.damageEnemy(b, Math.max(5, b.hpMax * 0.12), 0, 0, 0, {}); const p = EDF.W.player; if (p) p.hp = p.hpMax; return b.dead; });
    if (fini) break; await pause(page, 200);
  }
  const avant = await page.evaluate(() => ({ boss: { ...EDF.Game.state.boss }, majeurs: { ...(EDF.Game.state.bossMajeurs || {}) }, victoires: EDF.Game.state.stats.victoires }));
  // parcours des dialogues : on clique le premier choix à chaque fois (Continuer, Poursuivre, Rentrer…)
  const clics = [];
  for (let t = 0; t < 60; t++) {
    await pause(page, 500);
    const r = await page.evaluate(() => { const d = document.getElementById('dialog'); if (d.hidden) return null; const b = [...document.querySelectorAll('#dlgChoices button')].filter(x => !x.disabled); if (!b.length) return null; const txt = b.map(x => x.textContent); b[0].click(); return txt; });
    if (r) clics.push(r.join(' | '));
    const sc = await page.evaluate(() => EDF.Game.sceneName);
    if (sc === 'sanctuaire' && t > 4) break;
  }
  let scene = await page.evaluate(() => EDF.Game.sceneName);
  // si l'expédition continue (boss majeurs), on rentre au sanctuaire par la fin d'expédition normale
  if (scene === 'donjon') { await page.evaluate(() => EDF.endRun('retour')); await pause(page, 2500); for (let t = 0; t < 10; t++) { await pause(page, 400); await page.evaluate(() => { const b = document.querySelector('#dlgChoices button:not([disabled])'); if (b && !document.getElementById('dialog').hidden) b.click(); const c = document.querySelector('#cards .card'); if (c && !document.getElementById('cards').hidden) c.click(); }); } scene = await page.evaluate(() => EDF.Game.sceneName); }
  await pause(page, 3000);
  const apres = await page.evaluate(() => { const s = EDF.Game.state; return { scene: EDF.Game.sceneName, boss: { ...s.boss }, majeurs: { ...(s.bossMajeurs || {}) }, victoires: s.stats.victoires, res: { ...s.res } }; });
  const recharge = await page.evaluate(() => { EDF.saveGame(true); const r = EDF.loadGame(1); const s = EDF.Game.state; return { ok: !!(r && r.ok), boss: { ...s.boss }, majeurs: { ...(s.bossMajeurs || {}) }, victoires: s.stats.victoires, res: { ...s.res } }; });
  const err = await page.evaluate(() => EDF.Game.errors.slice());
  const toasts = await page.evaluate(() => window.__toasts);
  console.log(JSON.stringify({ bid, sceneFinale: apres.scene, clics, toastErreur: toasts.filter(t => /erreur/i.test(t)), erreursJeu: err.map(e => e.split('\n').slice(0, 4).join(' / ')), pageErrors: erreurs, victoires: [avant.victoires, apres.victoires, recharge.victoires], progression: { avant: [avant.boss, avant.majeurs], apresRecharge: [recharge.boss, recharge.majeurs] }, resIdentiquesApresRecharge: JSON.stringify(apres.res) === JSON.stringify(recharge.res) }));
  await page.screenshot({ path: `${process.env.OUT || '/tmp'}/cycle_${bid}.png` });
  await ctx.close();
}
await browser.close();
