// Vérification de fonctionnement d'une version archivée : démarrage, partie, 5 régions, sauvegarde/rechargement, export/import.
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const [file, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
const R = { fichier: file.split('/').pop(), etapes: [] };
const etape = (nom, ok, info) => R.etapes.push({ nom, ok, ...(info ? { info } : {}) });
await page.goto('file://' + file);
await page.waitForTimeout(3000);
etape('ecran titre', await page.evaluate(() => !document.getElementById('title').hidden && !!window.EDF));
await page.evaluate(() => { localStorage.clear(); EDF.newGame(1, { chevalier: 'Test', secte: 'QA' }); EDF.setScene('sanctuaire', { nouvelle: true }); });
await page.waitForTimeout(1500);
etape('sanctuaire', await page.evaluate(() => EDF.Game.sceneName === 'sanctuaire'));
const regions = await page.evaluate(() => Object.keys(EDF.REGIONS));
for (const r of regions) {
  const n0 = errs.length;
  await page.evaluate((r) => { EDF.UI.closeAll && EDF.UI.closeAll(); EDF.setScene('sanctuaire', {}); }, r);
  await page.waitForTimeout(400);
  await page.evaluate((r) => { EDF.UI.closeAll && EDF.UI.closeAll(); EDF.startExpedition(r); }, r);
  await page.waitForTimeout(800);
  for (let i = 0; i < 12; i++) { const k = ['KeyD','KeyS','KeyA','KeyW'][i % 4]; await page.keyboard.down(k); await page.keyboard.press('KeyJ'); await page.waitForTimeout(200); await page.keyboard.press('Space'); await page.keyboard.up(k); }
  const sc = await page.evaluate(() => EDF.Game.sceneName);
  await page.screenshot({ path: `${out}/region_${r}.png` });
  etape('expedition ' + r, errs.length === n0, { scene: sc });
}
const sl = await page.evaluate(() => {
  EDF.saveGame(true);
  const avant = JSON.stringify(EDF.Game.state.res);
  const code = EDF.exportSave();
  const imp = EDF.importSave(code);
  const load = EDF.loadGame(1);
  return { avant, apres: JSON.stringify(EDF.Game.state.res), imp: !!(imp && imp.ok), load: !!(load && load.ok), cles: Object.keys(localStorage).sort() };
});
etape('sauvegarde/rechargement', sl.load && sl.avant === sl.apres, { cles: sl.cles });
etape('export/import code de transfert', sl.imp);
R.erreursJS = errs;
R.erreursJeu = await page.evaluate(() => EDF.Game.errors.slice());
R.ok = R.etapes.every(e => e.ok) && errs.length === 0;
console.log(JSON.stringify(R, null, 1));
await browser.close();
