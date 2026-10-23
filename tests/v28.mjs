// Suite de vérification v28 — exécutée sur des COPIES locales (instantané v28 publié + archive de référence 8a67).
// Usage : node tests/v28.mjs <v28.html> <reference_8a67.html> <dossier_sortie>
// Toutes les commandes de jeu sont SIMULÉES (clavier automatisé, appels via window.EDF) : aucun résultat ne vaut session de jeu humaine.
import fs from 'fs';
import { chromium, ouvrir, erreursJeu, pause, agiter } from './lib.mjs';

const [CIBLE, REF, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const R = [];
const noter = (id, nom, resultat, details, limites) => { R.push({ id, nom, execute: true, resultat, details, limites }); console.log(id, resultat, nom); };
const sauf = async (id, nom, limites, fn) => { try { await fn(); } catch (e) { R.push({ id, nom, execute: true, resultat: 'échec', details: { exception: String(e && e.stack || e).slice(0, 600) }, limites }); console.log(id, 'EXCEPTION', String(e).slice(0, 200)); } };

async function nouvellePartie(page, classe, slot = 1) {
  await page.evaluate(([c, sl]) => { EDF.newGame(sl, { chevalier: 'Test', secte: 'QA', classe: c }); EDF.setScene('sanctuaire', {}); }, [classe, slot]);
  await pause(page, 900);
}
async function expedition(page, region) {
  await page.evaluate((r) => { EDF.UI.closeAll && EDF.UI.closeAll(); EDF.setScene('sanctuaire', {}); }, region);
  await pause(page, 300);
  await page.evaluate((r) => { EDF.UI.closeAll && EDF.UI.closeAll(); EDF.startExpedition(r); }, region);
  await pause(page, 1200);
  await page.evaluate(() => { EDF.UI.closeAll && EDF.UI.closeAll(); });
}

/* ---------- T1 : non-régression des fonctions de base ---------- */
await sauf('T1', 'Non-régression : titre, partie, sanctuaire, 5 régions, sauvegarde, code de transfert', '', async () => {
  const { ctx, page, erreurs } = await ouvrir(browser, CIBLE);
  await nouvellePartie(page, 'chevalier');
  const regions = await page.evaluate(() => Object.keys(EDF.REGIONS));
  const parRegion = {};
  for (const r of regions) { const n0 = erreurs.length; await expedition(page, r); await agiter(page, 4); parRegion[r] = { scene: await page.evaluate(() => EDF.Game.sceneName), erreurs: erreurs.length - n0 }; await page.screenshot({ path: `${OUT}/T1_${r}.png` }); }
  const sv = await page.evaluate(() => { EDF.saveGame(true); const avant = JSON.stringify(EDF.Game.state); const code = EDF.exportSave(); const imp = EDF.importSave(code); const ld = EDF.loadGame(1); return { imp: !!(imp && imp.ok), ld: !!(ld && ld.ok), identique: JSON.stringify(EDF.Game.state) === avant }; });
  const err = await erreursJeu(page, erreurs);
  const ok = Object.values(parRegion).every((x) => x.scene === 'donjon' && x.erreurs === 0) && sv.imp && sv.ld && err.length === 0;
  noter('T1', 'Non-régression : titre, partie, sanctuaire, 5 régions, sauvegarde, code de transfert', ok ? 'réussi' : 'échec', { regions: parRegion, sauvegarde: sv, erreurs: err },
    'Expéditions de 4 s avec commandes simulées ; ne vérifie ni la progression complète d’une expédition ni le rendu visuel.');
  await ctx.close();
});

/* ---------- T2 : animations d'attaque v28 ---------- */
await sauf('T2', 'Animations d’attaque v28 (poses dessinées)', '', async () => {
  const { ctx, page, erreurs } = await ouvrir(browser, CIBLE);
  // T2a : couverture statique — quelles classes/armes ont des poses dessinées
  const couverture = await page.evaluate(() => {
    const P = EDF.SPR.posesAtk || null;
    const out = { classesAvecPoses: P ? Object.keys(P) : [], gestes: {}, armes: {} };
    if (P) for (const c in P) out.gestes[c] = Object.fromEntries(Object.entries(P[c]).map(([g, D]) => [g, Object.fromEntries(Object.entries(D).map(([d, ph]) => [d, Object.keys(ph)]))]));
    for (const a in EDF.ARMES) out.armes[a] = EDF.ARMES[a].style || EDF.ARMES[a].type || '?';
    return out;
  });
  // T2b : rendu réel des poses pour le chevalier, chaque arme, 3 directions, réglage v28 puis « ancienne » ; capture au ralenti
  const captures = [];
  const differences = [];
  await nouvellePartie(page, 'chevalier');
  await expedition(page, 'foret');
  await page.evaluate(() => { EDF.W.enemies.length = 0; });
  // Sonde : compte les affichages des images de poses chargées par le jeu (EDF.SPR.posesAtk) — mesure directe, indépendante du décor
  const nbPoses = await page.evaluate(() => {
    const S = new WeakSet(); let n = 0;
    const P = EDF.SPR.posesAtk || {};
    for (const c in P) for (const g in P[c]) for (const d in P[c][g]) for (const ph in P[c][g][d]) { const f = P[c][g][d][ph]; for (const k of ['r', 'l', 'w']) if (f[k]) { f[k].__ph = ph; S.add(f[k]); n++; } }
    window.__poses = 0; window.__phases = {};
    const orig = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img) { if (S.has(img)) { window.__poses++; window.__phases[img.__ph] = (window.__phases[img.__ph] || 0) + 1; } return orig.apply(this, arguments); };
    return n;
  });
  // armes censées utiliser les poses (GESTE_STYLE lu dans le code [T] : epee, consumee, deux → léger ; espadon → lourd)
  const GESTE = { epee: 'leger', consumee: 'leger', deux: 'leger', espadon: 'lourd' };
  for (const arme of Object.keys(couverture.armes)) {
    const ok = await page.evaluate((a) => { try { EDF.equiperArme(EDF.W.player, { id: a, rang: 0 }); return EDF.W.player.weapon && true; } catch (e) { return String(e); } }, arme);
    if (ok !== true) { captures.push({ arme, erreur: ok }); continue; }
    for (const [dir, key] of [['down', 'KeyS'], ['up', 'KeyW'], ['side', 'KeyD']]) {
      const hashes = {};
      for (const mode of ['v28', 'ancienne']) {
        await page.evaluate((m) => { EDF.Game.settings.animCombat = m; EDF.Game.slowmo = 1; const p = EDF.W.player; p.hp = p.hpMax; }, mode);
        await page.keyboard.down(key); await pause(page, 120); await page.keyboard.up(key); await pause(page, 150);
        await page.evaluate(() => { window.__poses = 0; });
        await page.keyboard.press('KeyJ');
        await page.evaluate(() => { EDF.Game.slowmo = 0.04; });
        const imgs = [];
        for (let i = 0; i < 4; i++) {
          await pause(page, 120);
          const enAttaque = await page.evaluate(() => { const p = EDF.W.player; return p.st > 0 || p.atkCd > 0; });
          const clip = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(), k = r.width / EDF.Game.view.w, p = EDF.W.player, C = EDF.Cam; return { x: Math.max(0, r.left + (p.x - C.x - 28) * k), y: Math.max(0, r.top + (p.y - C.y - 44) * k), width: 56 * k, height: 56 * k }; });
          const buf = await page.screenshot({ clip });
          imgs.push({ enAttaque, taille: buf.length, h: buf.toString('base64').slice(-64) });
          if (mode === 'v28' && i === 1) fs.writeFileSync(`${OUT}/T2_${arme}_${dir}.png`, buf);
        }
        await page.evaluate(() => { EDF.Game.slowmo = 1; });
        await pause(page, 500);
        hashes[mode] = imgs;
        // mesure à vitesse normale : jusqu'à 3 attaques, on retient la première qui affiche des poses
        let mes = { poses: 0, phases: {} };
        for (let essai = 0; essai < 3 && mes.poses === 0; essai++) {
          await page.evaluate(() => { window.__poses = 0; window.__phases = {}; });
          await page.keyboard.down(key); await pause(page, 120); await page.keyboard.up(key); await pause(page, 150);
          await page.keyboard.press('KeyJ'); await pause(page, 900);
          mes = await page.evaluate(() => ({ poses: window.__poses, phases: { ...window.__phases } }));
        }
        hashes[mode].poses = mes.poses; hashes[mode].phases = mes.phases;
      }
      const vuAttaque = hashes.v28.some((x) => x.enAttaque);
      const attendu = !!GESTE[couverture.armes[arme]] && couverture.classesAvecPoses.includes('chevalier');
      const ph = hashes.v28.phases, troisPhases = ['prep', 'frappe', 'recup'].every((k) => ph[k] > 0);
      const conforme = attendu ? troisPhases && hashes.ancienne.poses === 0 : hashes.v28.poses === 0 && hashes.ancienne.poses === 0;
      differences.push({ arme, dir, attaqueObservee: vuAttaque, posesAttendues: attendu, phasesV28: ph, affichagesPosesAncienne: hashes.ancienne.poses, conforme });
    }
  }
  // T2c : autres classes (rendu procédural attendu) — attaques dans 3 directions sans erreur
  const autres = {};
  for (const c of ['assassin', 'mage', 'berserker']) {
    const n0 = erreurs.length;
    await nouvellePartie(page, c);
    await expedition(page, 'foret');
    for (const key of ['KeyS', 'KeyW', 'KeyD', 'KeyA']) { await page.keyboard.down(key); await pause(page, 100); await page.keyboard.up(key); await page.keyboard.press('KeyJ'); await pause(page, 350); }
    await page.screenshot({ path: `${OUT}/T2c_${c}.png` });
    autres[c] = { erreurs: erreurs.length - n0 };
  }
  await page.evaluate(() => { EDF.Game.settings.animCombat = 'v28'; EDF.Game.slowmo = 1; });
  const err = await erreursJeu(page, erreurs);
  const ok = err.length === 0 && differences.every((d) => d.attaqueObservee && d.conforme);
  noter('T2', 'Animations d’attaque v28 (poses dessinées)', ok ? 'réussi' : 'échec',
    { couverture, imagesDePosesSondees: nbPoses, chevalier: differences, nonConformes: differences.filter((d) => !d.conforme).map((d) => d.arme + '/' + d.dir), autresClasses: autres, erreurs: err },
    'Mesure directe : affichages des images de poses par phase (prep/frappe/recup) pendant une attaque à vitesse normale (sonde sur drawImage, jusqu’à 3 essais), pour chaque arme et direction, réglages v28 et « ancienne ». Vérifie l’usage des poses et l’absence d’erreur, PAS leur qualité visuelle (captures T2_*.png à examiner) ni le ressenti. NE JUGE PAS la qualité visuelle (captures à examiner par un humain). Une différence d’image peut aussi venir d’éléments animés du décor.');
  await ctx.close();
});

/* ---------- T3 : compteurs économiques v28 ---------- */
await sauf('T3', 'Compteurs économiques (s.eco)', '', async () => {
  const { ctx, page, erreurs } = await ouvrir(browser, CIBLE);
  await nouvellePartie(page, 'chevalier');
  const r = await page.evaluate(() => {
    const s = EDF.Game.state, out = {};
    out.ecoInitial = s.eco ? JSON.parse(JSON.stringify(s.eco)) : null;
    // gain catégorisé
    const avantBois = s.res.bois || 0;
    const g = EDF.gainRes('bois', 7, 'test_gain');
    out.gain = { rendu: g, enregistre: s.eco && s.eco.gagne && s.eco.gagne.bois && s.eco.gagne.bois.test_gain, resDelta: (s.res.bois || 0) - avantBois };
    // plafond : le surplus doit aller dans « perdu / plafond »
    const g2 = EDF.gainRes('bois', 100000, 'test_plafond');
    out.plafond = { gagne: g2, perdu: s.eco.perdu && s.eco.perdu.bois && s.eco.perdu.bois.plafond, attenduPerdu: 100000 - g2 };
    // dépense via une construction réelle (tryBuild → pay(cout, 'construction'))
    for (const k of EDF.RES_LIST) s.res[k] = Math.max(s.res[k] || 0, 200);
    const avantDep = JSON.stringify(s.eco.depense || {});
    let construit = null; const refus = {};
    for (const t in EDF.BATIMENTS) {
      for (let tx = 2; tx < 60 && !construit; tx += 2) for (let ty = 2; ty < 40 && !construit; ty += 2) {
        try { const res = EDF.tryBuild(t, tx, ty); if (res && res.ok) construit = { type: t, tx, ty }; else refus[t] = res && res.msg; } catch (e) { refus[t] = 'exception ' + String(e); }
      }
      if (construit) break;
    }
    out.refusConstruction = construit ? undefined : refus;
    out.construction = { construit, depenseConstruction: s.eco.depense ? Object.fromEntries(Object.entries(s.eco.depense).map(([k, v]) => [k, v.construction || 0])) : null, change: JSON.stringify(s.eco.depense || {}) !== avantDep };
    // dépense par les adeptes (repas) via simulation d'heures
    s.res.nourriture = 50;
    for (let i = 0; i < 24; i++) EDF.simulateHour(false);
    out.adeptes = { depenseNourriture: s.eco.depense && s.eco.depense.nourriture ? s.eco.depense.nourriture : null };
    // sauvegarde/rechargement conserve s.eco
    const avant = JSON.stringify(s.eco);
    EDF.saveGame(true); EDF.loadGame(1);
    out.persistance = JSON.stringify(EDF.Game.state.eco) === avant;
    return out;
  });
  // ouverture du panneau Statistiques
  const n0 = erreurs.length;
  const panneau = await page.evaluate(() => { EDF.openStats(); const p = document.getElementById('panels'); return { ouvert: p.children.length > 0, texte: p.innerText.slice(0, 300) }; });
  await page.screenshot({ path: `${OUT}/T3_statistiques.png` });
  await page.evaluate(() => EDF.UI.closeAll && EDF.UI.closeAll());
  const err = await erreursJeu(page, erreurs);
  const ok = r.gain.enregistre === r.gain.rendu && r.plafond.perdu === r.plafond.attenduPerdu && r.construction.change && r.persistance && panneau.ouvert && err.length === 0;
  noter('T3', 'Compteurs économiques (s.eco)', ok ? 'réussi' : 'échec', { ...r, panneauStats: { ouvert: panneau.ouvert, erreurs: erreurs.length - n0, extrait: panneau.texte }, erreurs: err },
    'Couvre gain, plafond, construction, repas des adeptes, persistance et panneau. Ne vérifie pas toutes les catégories ni l’exactitude comptable sur une longue partie.');
  await ctx.close();
});

/* ---------- T4 : les neuf boss ---------- */
const BOSS_PLAN = [
  ['racine', 'foret', 'boss'], ['chasseur', 'foret', 'chasseur'], ['ossu', 'catacombes', 'boss'], ['cendre', 'catacombes', 'cendrebrune'],
  ['myco', 'fongique', 'boss'], ['abbesse', 'fongique', 'abbesse'], ['eteignoir', 'domaine', 'boss'], ['engloutie', 'lac', 'boss'], ['justine', 'lac', 'justine'],
];
for (const [bid, region, noeud] of BOSS_PLAN) {
  const nom = `Boss ${bid} : apparition, 30 s de combat simulé, phases, défaite`;
  await sauf('T4-' + bid, nom, '', async () => {
    const { ctx, page, erreurs } = await ouvrir(browser, CIBLE);
    await nouvellePartie(page, 'chevalier');
    await expedition(page, region);
    await page.evaluate(([n]) => {
      const sc = EDF.Scenes.current, run = EDF.Game.state.run;
      if (n === 'justine') { sc.enterJustine(); return; }
      run.layers[run.couche][run.choix] = { type: n };
      sc.loadNode();
    }, [noeud]);
    await pause(page, 1500);
    const apparu = await page.evaluate(() => { const b = EDF.W.boss; return b ? { id: b.id, hp: b.hp, hpMax: b.hpMax, etat: b.state } : null; });
    const etats = new Set(), attaques = new Set();
    let phaseMax = 0;
    const echantillon = async () => { const o = await page.evaluate(() => { const b = EDF.W.boss; return b ? { st: b.state, atk: b.atk && (b.atk.type || b.atk.nom || b.atk.id || (typeof b.atk === 'string' ? b.atk : 'objet')), ph: b.phase, mort: b.dead } : null; }); if (o) { etats.add(o.st); if (o.atk) attaques.add(String(o.atk)); phaseMax = Math.max(phaseMax, o.ph || 0); } };
    // 30 s : le joueur s'approche, attaque, esquive ; soins forcés pour que l'IA du boss tourne toute la durée (instrumentation de test)
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => { const p = EDF.W.player, b = EDF.W.boss; if (p && b && !b.dead) { const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1; if (d > 40) { p.x += dx / d * 20; p.y += dy / d * 20; } } });
      await agiter(page, 2, { soigner: true });
      await echantillon();
      if (i === 7) await page.screenshot({ path: `${OUT}/T4_${bid}.png` });
    }
    // phases forcées : on retire des PV jusqu'à 55 % puis 25 % (dégâts appliqués par le test, pas par le joueur)
    for (const seuil of [0.55, 0.25]) {
      // les serviteurs (ex. fidèles de l'Abbesse, qui la protègent en priant) sont abattus d'abord, comme le ferait le joueur
      await page.evaluate((s) => { for (const o of EDF.W.enemies) if (!o.isBoss && !o.dead) EDF.damageEnemy(o, 9999, 0, 0, 0, {}); }, seuil);
      await pause(page, 300);
      await page.evaluate((s) => { const b = EDF.W.boss; if (b && !b.dead && b.hp > b.hpMax * s) EDF.damageEnemy(b, b.hp - b.hpMax * s, 0, 0, 0, {}); }, seuil);
      await agiter(page, 4, { soigner: true });
      await echantillon();
    }
    // défaite : coups jusqu'à la mort (au plus 40 essais)
    for (let k = 0; k < 40; k++) {
      const fini = await page.evaluate(() => { const b = EDF.W.boss; if (!b || b.dead) return true; for (const o of EDF.W.enemies) if (!o.isBoss && !o.dead) EDF.damageEnemy(o, 9999, 0, 0, 0, {}); EDF.damageEnemy(b, Math.max(5, b.hpMax * 0.1), 0, 0, 0, {}); return b.dead; });
      if (fini) break;
      await pause(page, 250);
    }
    await pause(page, 4000);
    const fin = await page.evaluate(() => ({ mort: !EDF.W.boss || EDF.W.boss.dead, scene: EDF.Game.sceneName }));
    const err = await erreursJeu(page, erreurs);
    const ok = !!apparu && apparu.id === bid && fin.mort && err.length === 0;
    noter('T4-' + bid, nom, ok ? 'réussi' : 'échec', { apparu, etatsObserves: [...etats], attaquesObservees: [...attaques], phaseMax, fin, erreurs: err },
      'Combat SIMULÉ : déplacements/attaques automatisés, soins forcés, serviteurs abattus puis PV du boss retirés par le test (via damageEnemy, sans contourner l’invulnérabilité) pour atteindre les phases puis la défaite. Vérifie l’absence d’erreur et le déroulement, PAS la difficulté, la lisibilité ni l’équilibrage. Salle obtenue en remplaçant la salle courante, sans parcourir l’expédition.');
    await ctx.close();
  });
}

/* ---------- T5 : compatibilité des sauvegardes d'avant v28 (archive 8a67) ---------- */
await sauf('T5', 'Sauvegarde créée avec l’archive 8a67 chargée dans la v28', '', async () => {
  const A = await ouvrir(browser, REF);
  await nouvellePartie(A.page, 'mage');
  await A.page.evaluate(() => { for (const k of EDF.RES_LIST) EDF.gainRes(k, 40); for (let i = 0; i < 12; i++) EDF.simulateHour(false); EDF.saveGame(true); });
  await expedition(A.page, 'foret'); await agiter(A.page, 3);
  await A.page.evaluate(() => { EDF.saveGame(true); });
  const source = await A.page.evaluate(() => {
    const s = EDF.Game.state, st = {}; for (const k of Object.keys(localStorage)) st[k] = localStorage.getItem(k);
    return { stockage: st, code: EDF.exportSave(), resume: { nom: s.joueur.nom, classe: s.joueur.classe, res: s.res, adeptes: s.adeptes.map((a) => a.nom), batiments: s.batiments.length, temps: s.temps, version: s.version, enExpedition: !!s.run, eco: !!s.eco } };
  });
  const errA = await erreursJeu(A.page, A.erreurs);
  await A.ctx.close();
  // chargement dans la v28 avec exactement le même stockage local
  const B = await ouvrir(browser, CIBLE, { initStorage: source.stockage });
  await B.page.click('#btnContinue');
  await pause(B.page, 2500);
  const charge = await B.page.evaluate(() => { const s = EDF.Game.state; return s ? { scene: EDF.Game.sceneName, nom: s.joueur.nom, classe: s.joueur.classe, res: s.res, adeptes: s.adeptes.map((a) => a.nom), batiments: s.batiments.length, temps: s.temps, version: s.version, enExpedition: !!s.run, eco: s.eco ? JSON.parse(JSON.stringify(s.eco)) : null } : null; });
  await B.page.screenshot({ path: `${OUT}/T5_reprise.png` });
  await agiter(B.page, 4);
  await B.page.evaluate(() => { EDF.saveGame(true); });
  const errB = await erreursJeu(B.page, B.erreurs);
  await B.ctx.close();
  // import par code de transfert dans une v28 vierge
  const C = await ouvrir(browser, CIBLE);
  const imp = await C.page.evaluate((code) => { localStorage.clear(); const r = EDF.importSave(code); return { ok: !!(r && r.ok), erreur: r && r.erreur, nom: EDF.Game.state && EDF.Game.state.joueur.nom }; }, source.code);
  const errC = await erreursJeu(C.page, C.erreurs);
  await C.ctx.close();
  const S = source.resume, cmp = charge && { nom: charge.nom === S.nom, classe: charge.classe === S.classe, res: JSON.stringify(charge.res) === JSON.stringify(S.res), adeptes: JSON.stringify(charge.adeptes) === JSON.stringify(S.adeptes), batiments: charge.batiments === S.batiments, temps: charge.temps === S.temps, expedition: charge.enExpedition === S.enExpedition };
  const ok = !!charge && Object.values(cmp).every(Boolean) && imp.ok && errA.length + errB.length + errC.length === 0;
  noter('T5', 'Sauvegarde créée avec l’archive 8a67 chargée dans la v28', ok ? 'réussi' : 'échec',
    { sourceResume: S, apresChargement: charge && { ...charge, eco: charge.eco ? 'présent' : 'absent' }, comparaison: cmp, importCodeTransfert: imp, erreurs: { reference: errA, v28: errB, import: errC } },
    'Une seule sauvegarde synthétique (début de partie + 12 h simulées + expédition en cours). Ne couvre pas une sauvegarde de fin de jeu ni les vraies sauvegardes des joueurs, qui sont dans leur navigateur.');
});

/* ---------- T6 : performance indicative (v28 vs 8a67) ---------- */
await sauf('T6', 'Performance indicative : v28 contre 8a67, processeur ralenti ×4', '', async () => {
  const mesurer = async (f) => {
    const { ctx, page, erreurs } = await ouvrir(browser, f, { cpu: 4 });
    await nouvellePartie(page, 'chevalier'); await expedition(page, 'foret');
    await page.evaluate(() => { window.__dt = []; let t0 = performance.now(); const f = (t) => { window.__dt.push(t - t0); t0 = t; if (window.__dt.length < 100000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await agiter(page, 15);
    const m = await page.evaluate(() => { const d = window.__dt.slice(5).sort((a, b) => a - b); const moy = d.reduce((a, b) => a + b, 0) / d.length; return { images: d.length, msMoyen: +moy.toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2), plus33ms: d.filter((x) => x > 33.4).length }; });
    await ctx.close(); return m;
  };
  const ref = await mesurer(REF), v28 = await mesurer(CIBLE);
  const ecart = +(((v28.msMoyen - ref.msMoyen) / ref.msMoyen) * 100).toFixed(1);
  noter('T6', 'Performance indicative : v28 contre 8a67, processeur ralenti ×4', ecart <= 5 ? 'réussi' : 'à examiner', { reference8a67: ref, v28, ecartTempsImageMoyenPct: ecart, seuilPropose: '5 % (non validé)' },
    'Chromium headless dans un conteneur, ralentissement CPU émulé ; une seule mesure de 15 s par version, salles non identiques (génération aléatoire). Indicatif seulement : ne remplace pas une mesure sur téléphone réel.');
});

/* ---------- T7 : panneaux et fonctions du sanctuaire existants ---------- */
await sauf('T7', 'Panneaux et fonctions existants (menus, forge, journal, adeptes…)', '', async () => {
  const { ctx, page, erreurs } = await ouvrir(browser, CIBLE);
  await nouvellePartie(page, 'chevalier');
  const panneaux = {};
  for (const f of ['openForge', 'openEquipment', 'openJournal', 'openStats', 'openGuide', 'openSucces', 'openKnightSheet', 'openAdeptList', 'openSlotsMenu']) {
    const n0 = erreurs.length;
    const r = await page.evaluate((fn) => { try { EDF.UI.closeAll && EDF.UI.closeAll(); if (typeof EDF[fn] !== 'function') return { absent: true }; EDF[fn](); const p = document.getElementById('panels'); return { ouvert: p.children.length > 0 }; } catch (e) { return { exception: String(e) }; } }, f);
    await pause(page, 200);
    panneaux[f] = { ...r, erreurs: erreurs.length - n0 };
  }
  await page.evaluate(() => EDF.UI.closeAll && EDF.UI.closeAll());
  const n1 = erreurs.length;
  const sim = await page.evaluate(() => { for (let i = 0; i < 48; i++) EDF.simulateHour(false); return { heuresSimulees: 48 }; });
  const err = await erreursJeu(page, erreurs);
  const ok = Object.values(panneaux).every((p) => (p.ouvert || p.absent) && !p.exception && p.erreurs === 0) && err.length === 0;
  noter('T7', 'Panneaux et fonctions existants (menus, forge, journal, adeptes…)', ok ? 'réussi' : 'échec', { panneaux, simulation: { ...sim, erreurs: erreurs.length - n1 }, erreurs: err },
    'Vérifie l’ouverture des panneaux et 48 h de simulation sans erreur ; ne vérifie ni leur contenu ni leurs interactions détaillées.');
  await ctx.close();
});

await browser.close();
fs.writeFileSync(`${OUT}/resultats.json`, JSON.stringify({ cible: CIBLE.split('/').pop(), reference: REF.split('/').pop(), date: new Date().toISOString(), tests: R }, null, 1));
console.log('BILAN', R.map((t) => `${t.id}:${t.resultat}`).join(' '));
