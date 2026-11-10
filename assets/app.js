/* Big Wins 2026 : tableau de bord de suivi (Supabase REST, sans dépendance). */
(function () {
  "use strict";

  const CFG = window.BIGWIN_CONFIG;
  const REST = CFG.supabaseUrl.replace(/\/$/, "") + "/rest/v1";

  const STATUTS_ACT = {
    completee: "Complétée",
    en_cours: "En cours",
    non_demarree: "Non démarrée",
    reportee: "Reportée",
    annulee: "Annulée",
  };
  const STATUTS_OUT = {
    atteint: "Atteint",
    partiel: "Partiellement atteint",
    en_cours: "En cours",
    non_atteint: "Non atteint",
    non_renseigne: "Non renseigné",
  };
  const COUL = {
    completee: "var(--st-ok)", en_cours: "var(--st-wip)", non_demarree: "var(--st-ko)",
    reportee: "var(--st-na)", annulee: "var(--st-off)",
    atteint: "var(--st-ok)", partiel: "var(--st-part)", non_atteint: "var(--st-ko)", non_renseigne: "var(--st-na)",
  };
  const ZONE_COUL = { atteint: "#2e9e4f", en_cours: "#f2b01e", non_atteint: "#d64545", non_renseigne: "#a7adb4" };
  const ZONE_TXT = { atteint: "#1e7a3b", en_cours: "#9a6a00", non_atteint: "#a82e2e", non_renseigne: "#6b7480" };

  const S = {
    data: null,
    carte: null,
    tab: "stats",
    dep: "",
    sous: 0,
    partie: (() => { try { return localStorage.getItem("bigwin_partie") || "vue"; } catch (e) { return "vue"; } })(),
    session: lireSession(),
  };

  /* ---------- utilitaires ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const fmtDate = (d) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const nettoie = (t) => String(t || "").replace(/^\s*\*\s*/gm, "").replace(/\s+/g, " ").trim();
  const court = (t, n) => { t = nettoie(t); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t; };

  function lireSession() {
    try { return JSON.parse(sessionStorage.getItem("bigwin_session") || "null"); } catch (e) { return null; }
  }
  function ecrireSession(v) {
    S.session = v;
    try { v ? sessionStorage.setItem("bigwin_session", JSON.stringify(v)) : sessionStorage.removeItem("bigwin_session"); } catch (e) { /* stockage indisponible */ }
  }

  function toast(msg, err) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast show" + (err ? " err" : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.className = "toast"), 2600);
  }

  /* ---------- noms des Big Wins ---------- */
  const titreBW = (b) => b.titre || b.code;
  const nomBW = (b) => (b.titre ? b.titre + " : " + b.libelle : b.libelle || b.code);

  /* ---------- API ---------- */
  async function api(chemin, opts = {}) {
    const r = await fetch(REST + chemin, {
      ...opts,
      headers: { apikey: CFG.supabaseKey, "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    const txt = await r.text();
    const json = txt ? JSON.parse(txt) : null;
    if (!r.ok) throw new Error((json && (json.message || json.hint)) || "Erreur " + r.status);
    return json;
  }
  const rpc = (fn, args) => api("/rpc/" + fn, { method: "POST", body: JSON.stringify(args) });

  // Empreinte légère : change dès qu'une activité, un output ou un indicateur est mis à jour (par n'importe qui)
  async function lireEmpreinte() {
    try { return await rpc("etat_donnees", { p_code: S.session.code }); } catch (e) { return null; }
  }

  async function charger() {
    $("#erreur").hidden = true;
    const r = await rpc("charger_donnees", { p_code: S.session.code });
    S.session.dep = r.departement;
    const { departements, big_wins, strategies, activites, outputs, zones, output_zones, indicateurs, indicateur_valeurs, historique } = r;
    const d = { departements, big_wins, strategies, activites, outputs, zones, output_zones, indicateurs, indicateur_valeurs, historique };
    d.bwById = new Map(big_wins.map((b) => [b.id, b]));
    d.stratById = new Map(strategies.map((s) => [s.id, s]));
    d.zoneById = new Map(zones.map((z) => [z.id, z]));
    d.zonesParOutput = new Map();
    output_zones.forEach((oz) => {
      if (!d.zonesParOutput.has(oz.output_id)) d.zonesParOutput.set(oz.output_id, []);
      d.zonesParOutput.get(oz.output_id).push(oz.zone_id);
    });
    S.data = d;
    S.chargeA = new Date();
    S.empreinte = await lireEmpreinte();
  }

  async function chargerCarte() {
    if (S.carte) return S.carte;
    const r = await fetch("data/bf_provinces.json");
    S.carte = await r.json();
    return S.carte;
  }

  /* ---------- droits ---------- */
  const lectureSeule = () => !S.session || S.session.dep === "LECTURE";
  const estAdmin = () => S.session && (S.session.dep === "ADMIN" || S.session.dep === "MEL");
  function peutModifierStrat(strat) {
    if (!S.session) return false;
    return estAdmin() || (strat.departements || []).includes(S.session.dep);
  }
  function peutModifierOutput(o) {
    if (!S.session) return false;
    if (estAdmin()) return true;
    const strats = o.strategy_id ? [S.data.stratById.get(o.strategy_id)] : S.data.strategies.filter((s) => s.big_win_id === o.big_win_id);
    return strats.some((s) => s && (s.departements || []).includes(S.session.dep));
  }

  /* ---------- sélection selon le filtre département ---------- */
  function stratsFiltrees() {
    return S.data.strategies.filter((s) => !S.dep || (s.departements || []).includes(S.dep));
  }
  function activitesDe(stratIds) {
    const set = new Set(stratIds);
    return S.data.activites.filter((a) => set.has(a.strategy_id));
  }
  function outputsFiltres() {
    if (!S.dep) return S.data.outputs;
    const ids = new Set(stratsFiltrees().map((s) => s.id));
    const bws = new Set(stratsFiltrees().map((s) => s.big_win_id));
    return S.data.outputs.filter((o) => (o.strategy_id ? ids.has(o.strategy_id) : bws.has(o.big_win_id)));
  }
  function compter(liste, cles) {
    const c = Object.fromEntries(cles.map((k) => [k, 0]));
    liste.forEach((x) => (c[x.statut] = (c[x.statut] || 0) + 1));
    return c;
  }

  /* ---------- graphiques ---------- */
  function stackBar(compte, cles, total) {
    return '<div class="stack" role="img" aria-label="' +
      esc(cles.filter((k) => compte[k]).map((k) => compte[k] + " " + (STATUTS_ACT[k] || STATUTS_OUT[k]).toLowerCase()).join(", ")) + '">' +
      cles.map((k) => (compte[k] ? `<span style="width:${(100 * compte[k]) / total}%;background:${COUL[k]}" title="${esc((STATUTS_ACT[k] || STATUTS_OUT[k]) + " : " + compte[k])}"></span>` : "")).join("") +
      "</div>";
  }

  function projeter(lon, lat) {
    const p = S.carte.projection;
    return [(lon - p.lon0) * p.kx * p.echelle, (p.lat0 - lat) * p.echelle];
  }

  // Etat d'une zone pour un ensemble d'outputs
  function etatZone(outs) {
    if (!outs.length) return null;
    const c = compter(outs, Object.keys(STATUTS_OUT));
    const renseignes = outs.length - c.non_renseigne;
    if (!renseignes) return "non_renseigne";
    if (c.atteint / renseignes >= 0.5) return "atteint";
    if (c.atteint + c.partiel + c.en_cours > 0) return "en_cours";
    return "non_atteint";
  }

  function outputsParZone(outs) {
    const m = new Map();
    outs.forEach((o) => (S.data.zonesParOutput.get(o.id) || []).forEach((zid) => {
      if (!m.has(zid)) m.set(zid, []);
      m.get(zid).push(o);
    }));
    return m;
  }

  // Carte : couleur par zone (état des outputs) ou valeur d'indicateur
  function carteSVG(couleurs, opts = {}) {
    const C = S.carte;
    let [x0, y0, w, h] = C.viewBox;
    if (!opts.grand) {
      // Vignette : zoom sur la région des zones d'intervention, comme un encart
      const pts = S.data.zones.filter((z) => z.lat != null).map((z) => projeter(z.lon, z.lat));
      if (pts.length) {
        const cx = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2;
        const cy = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
        w = 230; h = 160; x0 = cx - w / 2; y0 = cy - h / 2;
      }
    }
    const parProv = new Map();
    S.data.zones.forEach((z) => { if (couleurs.has(z.id)) parProv.set(z.province, couleurs.get(z.id)); });
    let svg = `<svg viewBox="${x0} ${y0} ${w} ${h}" role="img" aria-label="${esc(opts.titre || "Carte des zones d'intervention")}">`;
    Object.entries(C.provinces).forEach(([nom, d]) => {
      const c = parProv.get(nom);
      svg += `<path class="prov" d="${d}" fill="${c ? c.fill : "var(--carte-fond)"}" stroke="var(--carte-trait)" stroke-width="${opts.grand ? 1 : 0.8}"><title>${esc(nom)}</title></path>`;
    });
    S.data.zones.forEach((z) => {
      const c = couleurs.get(z.id);
      if (!c || z.lat == null) return;
      const [x, y] = projeter(z.lon, z.lat);
      svg += `<circle cx="${x}" cy="${y}" r="${opts.grand ? 4 : 3}" fill="#fff" stroke="${c.txt}" stroke-width="2"/>`;
      const fs = opts.fs || (opts.grand ? 15 : 13);
      const label = esc(z.nom) + (opts.grand && c.valeur != null ? " · " + esc(c.valeur) : "");
      svg += `<text class="zone-label" x="${x + 7}" y="${y - 6}" font-size="${fs}" fill="${c.txt}">${label}</text>`;
    });
    return svg + "</svg>";
  }

  /* ---------- rendu : statistiques présentées comme le modèle PowerPoint ---------- */
  const M = { bleu: "#004D84", orange: "#F7941D", ciel: "#4FB3E3", gris: "#6D6E71", clair: "#D9D9D9", texte: "#1F2A36", hors: "#E9EDF1",
    vert: "#2E9E4F", ambre: "#F2B01E", ambreClair: "#F7D27A", rouge: "#D64545", grisStatut: "#A7ADB4" };
  const ACT_M = { completee: M.vert, en_cours: M.ambre, non_demarree: M.rouge, reportee: M.grisStatut, annulee: M.grisStatut };
  const OUT_M = { atteint: M.vert, partiel: M.ambreClair, en_cours: M.ambre, non_atteint: M.rouge, non_renseigne: M.grisStatut };
  const ZONE_M = { atteint: { fill: M.vert, txt: "#1E7A3B" }, en_cours: { fill: M.ambre, txt: "#9A6A00" },
    non_atteint: { fill: M.rouge, txt: "#A82E2E" }, non_renseigne: { fill: M.grisStatut, txt: M.gris } };
  const titreCourt = (b) => b.titre_court || court(b.libelle, 70);
  const codeBW = (b) => b.code.replace(" (politiques)", " pol.");
  const pluriel = (n, s, p) => n + " " + (n > 1 ? p : s);

  function barreM(segs, total, cls = "m-bar") {
    return `<div class="${cls}" role="img" aria-label="${esc(segs.filter((s) => s.n).map((s) => s.n + " " + s.lib).join(", "))}">` +
      segs.map((s) => (s.n ? `<span style="width:${(100 * s.n) / total}%;background:${s.c}" title="${esc(s.lib + " : " + s.n)}"></span>` : "")).join("") + "</div>";
  }
  const segsAct = (c) => [
    { n: c.completee, c: ACT_M.completee, lib: "finalisées" }, { n: c.en_cours, c: ACT_M.en_cours, lib: "en cours" },
    { n: c.non_demarree, c: ACT_M.non_demarree, lib: "non démarrées" },
    { n: c.reportee + c.annulee, c: ACT_M.reportee, lib: "reportées / annulées" }];
  const segsOut = (c) => ["atteint", "partiel", "en_cours", "non_atteint", "non_renseigne"].map((k) => ({ n: c[k], c: OUT_M[k], lib: STATUTS_OUT[k].toLowerCase() }));
  const OUT_PL = { atteint: ["atteint", "atteints"], partiel: ["partiel", "partiels"], en_cours: ["en cours", "en cours"],
    non_atteint: ["non atteint", "non atteints"], non_renseigne: ["non renseigné", "non renseignés"] };
  function resumeOut(c) {
    return ["atteint", "partiel", "en_cours", "non_atteint", "non_renseigne"].filter((k) => c[k])
      .map((k) => c[k] + " " + OUT_PL[k][c[k] > 1 ? 1 : 0]).join(" · ");
  }
  function couleursZonesM(outs) {
    const m = new Map();
    outputsParZone(outs).forEach((l, zid) => m.set(zid, ZONE_M[etatZone(l)]));
    return m;
  }
  const entete = (gauche, droite, id) => `<div class="m-entete"${id ? ` id="${id}"` : ""}><span>${gauche}</span><span>${droite || ""}</span></div>`;
  const legendeCarte = () => `<div class="m-legende">${[["Majorité atteints", M.vert], ["En cours / partiel", M.ambre], ["Non atteints", M.rouge], ["Non renseignés", M.grisStatut], ["Hors zone", M.hors]]
    .map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("")}</div>`;
  const legendeAct = () => `<div class="m-legende">${[["Finalisées", M.vert], ["En cours", M.ambre], ["Non démarrées", M.rouge], ["Reportées", M.grisStatut]]
    .map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("")}</div>`;

  const MOTS_VIDES = new Set(("a an and are as at be by for from has have in into is it its of on or over that the their this to with within " +
    "including include ensure ensuring based between through across all new one two three per via using use used each more other than " +
    "le la les de des du un une et en au aux pour par sur dans avec sans ce ces qui que leur leurs est sont plus ainsi à d l q1 q2 q3 q4 26 2026 01 02").split(" "));

  // Nuage de mots : ensemble des activités à mettre en œuvre
  function nuageMots(acts) {
    const freq = new Map();
    acts.forEach((a) => {
      String(a.libelle || "").toLowerCase().replace(/[’']/g, " ").split(/[^a-zà-ÿ0-9]+/i).forEach((m) => {
        if (m.length < 3 || MOTS_VIDES.has(m) || /^\d+$/.test(m)) return;
        freq.set(m, (freq.get(m) || 0) + 1);
      });
    });
    const mots = [...freq.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 70);
    if (!mots.length) return '<p class="m-vide">Aucune activité.</p>';
    const max = mots[0][1], min = mots[mots.length - 1][1];
    const couleurs = [M.bleu, M.orange, M.ciel, M.gris];
    // ordre mélangé mais stable (hachage du mot), les plus fréquents au centre
    const h = (t) => [...t].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
    const tries = mots.slice().sort((x, y) => h(x[0]) - h(y[0]));
    const centre = [];
    tries.forEach((m, i) => (i % 2 ? centre.push(m) : centre.unshift(m)));
    return `<div class="m-nuage" role="img" aria-label="Mots les plus fréquents : ${esc(mots.slice(0, 10).map((m) => m[0]).join(", "))}">${centre.map(([m, n]) => {
      const t = max > min ? (n - min) / (max - min) : 1;
      const taille = Math.round(13 + t * 30);
      const coul = couleurs[t > 0.6 ? 0 : t > 0.3 ? 1 : h(m) % 2 ? 2 : 3];
      return `<span style="font-size:${taille}px;color:${coul}" title="${esc(m)} : ${n}">${esc(m)}</span>`;
    }).join("")}</div>`;
  }

  // Taux d'achèvement coloré : vert ≥ 75 %, ambre ≥ 50 %, rouge sinon
  function tauxBadge(n, total) {
    if (!total) return '<span class="m-vide">–</span>';
    const t = pct(n, total);
    const c = t >= 75 ? M.vert : t >= 50 ? M.ambre : M.rouge;
    return `<span class="m-taux" style="background:${c}">${t} %</span>`;
  }

  // Formulations simples des outputs (repli sur les libellés d'origine)
  const objectifOut = (o) => o.objectif_clair || o.libelle_court || o.cible;
  const resultatOut = (o) => o.resultat_clair || o.valeur_realisee || "";
  const STATUT_SIMPLE = { atteint: "Objectif atteint", partiel: "Partiellement atteint", en_cours: "En cours",
    non_atteint: "Pas encore atteint", non_renseigne: "Résultat à renseigner" };

  // Chiffre clé d'un output : saisi à la main, sinon tiré de la valeur réalisée, sinon « Fait » s'il est atteint
  function extraireChiffre(texte) {
    const t = String(texte || "");
    let m = t.match(/(\d[\d\s\u00a0]*(?:[.,]\d+)?)\s?%/);
    if (m) return m[1].trim().replace(/\./, ",") + " %";
    m = t.match(/(?:^|[^\w])(\d{1,3}(?:[\s\u00a0]\d{3})+|\d+(?:[.,]\d+)?)(?![\w])/);
    return m ? m[1].trim() : "";
  }
  function chiffreCle(o) {
    return o.valeur_cle || extraireChiffre(o.valeur_realisee) || (o.statut === "atteint" ? "Fait" : "");
  }



  function enteteBW(b, a, deps, etiquette) {
    const c = compter(a, Object.keys(STATUTS_ACT));
    const nd = c.non_demarree, rp = c.reportee + c.annulee;
    return entete(`${esc(b.code)} · ${etiquette}`, esc(deps.join(", ").toUpperCase())) +
      `<div class="m-bw-tete"><div class="m-bw-code">${esc(codeBW(b))}</div><div>
        <h3 class="m-bw-titre">${esc(titreCourt(b))}</h3>
        <div class="m-bw-compte"><b class="o">${c.completee}</b> /${a.length} activités finalisées (${pct(c.completee, a.length)} %)
          · <b>${c.en_cours}</b> en cours · <b>${nd}</b> ${nd > 1 ? "non démarrées" : "non démarrée"}${rp ? ` · <b>${rp}</b> ${rp > 1 ? "reportées" : "reportée"}` : ""}</div></div></div>` +
      barreM(segsAct(c), Math.max(a.length, 1), "m-bar m-bar-bw");
  }

  function afficherPartie() {
    const diapos = $$("#rapport .m-diapo").filter((el) => el.dataset.partie === S.partie);
    if (S.sous >= diapos.length) S.sous = 0;
    $$("#rapport .m-diapo").forEach((el) => (el.hidden = el.dataset.partie !== S.partie || +el.dataset.sous !== S.sous));
    // second niveau : activités / outputs / zones d'un Big Win
    const sn = $("#rap-sous");
    sn.hidden = diapos.length < 2;
    sn.innerHTML = diapos.length < 2 ? "" : diapos.map((el, i) =>
      `<button type="button" role="tab" data-sous="${i}" aria-selected="${i === S.sous}"${i === S.sous ? ' class="actif"' : ""}>${esc(el.dataset.titre)}</button>`).join("");
    $("#bloc-maj").hidden = S.partie !== "maj";
    $$("#rap-nav button").forEach((b) => {
      const ok = b.dataset.partie === S.partie;
      b.classList.toggle("actif", ok);
      b.setAttribute("aria-selected", ok);
    });
    try { localStorage.setItem("bigwin_partie", S.partie); } catch (e) { /* ignoré */ }
  }

  // Carte d'un output : chiffre clé expliqué, objectif et résultat en phrases simples
  function carteOutput(t) {
    const cle = chiffreCle(t);
    const res = resultatOut(t);
    return `<div class="m-carte-out m-co-${t.statut}">
      <div class="m-carte-tete">${cle ? `<span class="m-gros">${esc(cle)}</span>` : "<span></span>"}
        <span class="m-statut" style="background:${OUT_M[t.statut]}">${STATUT_SIMPLE[t.statut]}</span></div>
      ${cle && t.chiffre_libelle ? `<div class="m-chiffre-lib">${esc(t.chiffre_libelle)}</div>` : ""}
      <p class="m-obj"><span>Objectif</span>${esc(objectifOut(t))}</p>
      <p class="m-res"><span>Résultat</span>${res ? esc(court(res, 260)) : '<em class="m-vide">Pas encore renseigné</em>'}</p>
    </div>`;
  }

  function renderStats() {
    const d = S.data;
    const strats = stratsFiltrees();
    const acts = activitesDe(strats.map((s) => s.id));
    const outs = outputsFiltres();
    const ca = compter(acts, Object.keys(STATUTS_ACT));
    const co = compter(outs, Object.keys(STATUTS_OUT));
    const parBw = d.big_wins.map((b) => {
      const st = strats.filter((s) => s.big_win_id === b.id);
      const a = activitesDe(st.map((s) => s.id));
      const o = outs.filter((x) => x.big_win_id === b.id);
      const deps = [...new Set(st.flatMap((s) => s.departements || []))];
      return { b, st, a, o, deps, c: compter(a, Object.keys(STATUTS_ACT)), co: compter(o, Object.keys(STATUTS_OUT)) };
    }).filter((x) => x.a.length || x.o.length);
    const filtre = S.dep ? ` · ${esc(S.dep).toUpperCase()}` : "";
    let h = "";

    // 1. Vue d'ensemble
    h += `<section class="m-diapo" id="m-vue">${entete("Vue d’ensemble", "Toutes les Big Wins" + filtre)}
      <h2 class="m-titre">${ca.completee} activités finalisées sur ${acts.length} · ${co.atteint} outputs atteints</h2>${legendeAct()}
      <div class="table-wrap"><table class="m-table"><thead><tr><th>Big Win</th><th></th><th>Avancement</th><th>Finalisées</th><th>En cours</th><th>Non dém.</th><th>Reportées</th><th>Outputs atteints</th></tr></thead><tbody>
      ${parBw.map((x) => `<tr><td class="m-code">${esc(codeBW(x.b))}</td><td>${esc(titreCourt(x.b))}</td>
        <td class="m-av">${barreM(segsAct(x.c), Math.max(x.a.length, 1))}</td><td class="m-n o">${x.c.completee}</td><td class="m-n">${x.c.en_cours}</td>
        <td class="m-n">${x.c.non_demarree}</td><td class="m-n">${x.c.reportee + x.c.annulee}</td><td class="m-n b">${x.co.atteint}<small>/${x.o.length}</small></td></tr>`).join("")}
      <tr class="m-total"><td>Total</td><td></td><td></td><td class="m-n o">${ca.completee}</td><td class="m-n">${ca.en_cours}</td>
        <td class="m-n">${ca.non_demarree}</td><td class="m-n">${ca.reportee + ca.annulee}</td><td class="m-n b">${co.atteint}<small>/${outs.length}</small></td></tr>
      </tbody></table></div></section>`;

    // 2. Chiffres clés et graphiques
    const deps = d.departements.filter((x) => !["ADMIN", "MEL", "LECTURE"].includes(x.code)).map((dep) => {
      const st = strats.filter((s) => (s.departements || []).includes(dep.code));
      const ids = new Set(st.map((s) => s.id)), bws = new Set(st.map((s) => s.big_win_id));
      const a = activitesDe([...ids]);
      // outputs du département : ceux de ses stratégies (ou de ses Big Wins quand l'output n'a pas de stratégie)
      const o = outs.filter((t) => (t.strategy_id ? ids.has(t.strategy_id) : bws.has(t.big_win_id)));
      return { dep, a, o, c: compter(a, Object.keys(STATUTS_ACT)), co: compter(o, Object.keys(STATUTS_OUT)) };
    }).filter((x) => x.a.length).sort((p, q) => q.a.length - p.a.length);
    const maxDep = Math.max(1, ...deps.map((x) => x.a.length));
    const parts = [{ l: "Finalisées", n: ca.completee, c: M.vert }, { l: "En cours", n: ca.en_cours, c: M.ambre },
      { l: "Non démarrées", n: ca.non_demarree, c: M.rouge }, { l: "Reportées", n: ca.reportee + ca.annulee, c: M.grisStatut }];
    let ang = 0;
    const R = 70, r = 42, cx = 90, cy = 90;
    const arc = (p) => {
      const a0 = ang, a1 = ang + (p.n / Math.max(acts.length, 1)) * Math.PI * 2; ang = a1;
      if (!p.n) return "";
      if (p.n === acts.length) return `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${p.c}" stroke-width="${R - r}"/>`;
      const pt = (rad, t) => [cx + rad * Math.sin(t), cy - rad * Math.cos(t)];
      const [x1, y1] = pt(R, a0), [x2, y2] = pt(R, a1), [x3, y3] = pt(r, a1), [x4, y4] = pt(r, a0);
      const g = a1 - a0 > Math.PI ? 1 : 0;
      return `<path d="M${x1},${y1}A${R},${R} 0 ${g} 1 ${x2},${y2}L${x3},${y3}A${r},${r} 0 ${g} 0 ${x4},${y4}Z" fill="${p.c}"><title>${p.l} : ${p.n}</title></path>`;
    };
    h += `<section class="m-diapo" id="m-chiffres">${entete("Chiffres clés", "Toutes les Big Wins" + filtre)}
      <div class="m-kpis">${[[parBw.length, "Big Wins et enablers"], [acts.length, "Activités planifiées"], [ca.completee, "Activités finalisées"], [co.atteint, "Outputs atteints"]]
        .map(([v, l]) => `<div class="m-kpi"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
      <div class="m-graphes">
        <div class="m-graphe"><h4>Taux de réalisation des activités (%) par Big Win</h4>
          <div class="m-colonnes">${parBw.map((x) => {
            const n = Math.max(x.a.length, 1);
            return `<div class="m-col"><div class="m-col-pile">${segsAct(x.c).slice().reverse().map((s) => (s.n ? `<span style="height:${(100 * s.n) / n}%;background:${s.c}" title="${esc(s.lib)} : ${pct(s.n, n)} %"></span>` : "")).join("")}</div>
              <b>${pct(x.c.completee, n)} %</b><small>${esc(codeBW(x.b))}</small></div>`;
          }).join("")}</div>${legendeAct()}</div>
        <div class="m-graphe"><h4>Répartition des activités par statut</h4>
          <div class="m-donut"><svg viewBox="0 0 180 180" role="img" aria-label="${parts.map((p) => p.n + " " + p.l.toLowerCase()).join(", ")}">${parts.map(arc).join("")}
            <text x="90" y="88" text-anchor="middle" font-size="26" font-weight="700" fill="${M.vert}">${pct(ca.completee, acts.length)} %</text>
            <text x="90" y="106" text-anchor="middle" font-size="10" fill="${M.gris}">finalisées</text></svg>
          <ul>${parts.map((p) => `<li><i style="background:${p.c}"></i>${p.l}<b>${p.n}</b><small>${pct(p.n, acts.length)} %</small></li>`).join("")}</ul></div></div>
        <div class="m-graphe"><h4>Activités Big Win à mettre en œuvre</h4>${nuageMots(acts)}</div>
        <div class="m-graphe"><h4>Activités par département : nombre, statut et taux d'achèvement</h4>
          <div class="table-wrap"><table class="m-table m-dep"><thead><tr>
            <th>Département</th><th>Activités</th><th>Fin.</th><th>En cours</th><th>Non dém.</th><th>Report.</th><th>Achèv.</th><th></th></tr></thead><tbody>
          ${deps.map((x) => {
            const nd = x.c.non_demarree, rp = x.c.reportee + x.c.annulee;
            const lien = (statut, n) => `<button type="button" class="m-lien" data-voir-dep="${esc(x.dep.code)}" data-voir-statut="${statut}"
              title="Voir ces activités dans la synthèse des activités">${n}</button>`;
            return `<tr class="m-dep-ligne" data-voir-dep="${esc(x.dep.code)}" data-voir-statut="" title="Voir et mettre à jour les activités de ce département">
              <td><b class="m-dep-nom">${esc(x.dep.libelle)}</b></td>
              <td class="m-dep-barre"><div class="m-dep-l"><div class="m-dep-zone"><div style="width:${(100 * x.a.length) / maxDep}%">${x.a.length ? barreM(segsAct(x.c), x.a.length) : ""}</div></div><b>${x.a.length}</b></div></td>
              <td class="m-n">${lien("completee", x.c.completee)}</td><td class="m-n">${lien("en_cours", x.c.en_cours)}</td><td class="m-n">${lien("non_demarree", nd)}</td><td class="m-n">${lien("reportee", rp)}</td>
              <td class="m-n">${tauxBadge(x.c.completee, x.a.length)}</td>
              <td class="m-n"><span class="m-maj" aria-hidden="true">→</span></td></tr>`;
          }).join("")}
          <tr class="m-total"><td>Total (sans double compte)</td><td class="m-dep-barre"><div class="m-dep-l"><div class="m-dep-zone">${barreM(segsAct(ca), Math.max(acts.length, 1))}</div><b>${acts.length}</b></div></td>
            <td class="m-n">${ca.completee}</td><td class="m-n">${ca.en_cours}</td><td class="m-n">${ca.non_demarree}</td><td class="m-n">${ca.reportee + ca.annulee}</td>
            <td class="m-n">${tauxBadge(ca.completee, acts.length)}</td><td></td></tr>
          </tbody></table></div>${legendeAct()}</div>
      </div></section>`;

    // 4. Chaque Big Win : activités, outputs atteints, zones
    parBw.forEach((x) => {
      const { b, st, a, o, deps: dp } = x;
      const fini = a.filter((t) => t.statut === "completee");
      // activités finalisées par stratégie
      h += `<section class="m-diapo" id="m-bw-${b.id}">${enteteBW(b, a, dp, "Activités finalisées")}
        <h4 class="m-section">Activités finalisées · ${fini.length}</h4>
        ${fini.length ? `<div class="m-strats">${st.map((s) => {
          const as = a.filter((t) => t.strategy_id === s.id);
          const nf = as.filter((t) => t.statut === "completee").length;
          if (!nf) return "";
          // une puce par activité finalisée (le nombre affiché = nombre de puces) ; « ce qui a été fait » en dessous
          const vus = new Set();
          const puces = as.filter((t) => t.statut === "completee").map((t) => {
            const c = String(t.commentaire || "").trim();
            const cle = c.toLowerCase();
            const fait = c && !vus.has(cle) ? (vus.add(cle), c) : "";
            return `<li><span class="m-act">${esc(court(t.libelle, 140))}</span>${fait ? `<small class="m-fait">${esc(court(fait.replace(/\s*\n+\s*/g, " · "), 220))}</small>` : ""}</li>`;
          });
          return `<div class="m-strat"><div class="m-strat-tete"><b>${nf}</b><span>${esc(s.titre_court || court(s.libelle, 80))}</span></div>
            <ul>${puces.join("")}</ul></div>`;
        }).join("")}</div>` : '<p class="m-vide">Aucune activité finalisée à ce jour.</p>'}
        ${[["en_cours", "En cours"], ["non_demarree", "Non démarrées"], ["reportee", "Reportées / annulées"]].map(([k, titre]) => {
          const l = a.filter((t) => (k === "reportee" ? ["reportee", "annulee"].includes(t.statut) : t.statut === k));
          return l.length ? `<div class="m-reste"><h5>${titre} · ${l.length}</h5><ul>${l.map((t) => `<li>${esc(court(t.libelle, 150))}</li>`).join("")}</ul></div>` : "";
        }).join("")}</section>`;

      // outputs atteints
      const at = o.filter((t) => t.statut === "atteint");
      const autres = o.filter((t) => t.statut !== "atteint");
      h += `<section class="m-diapo">${enteteBW(b, a, dp, "Outputs atteints")}
        <h4 class="m-section">Outputs atteints <span class="m-section-n">${at.length}<small>/${o.length}</small></span></h4>
        ${at.length ? `<div class="m-cartes">${at.map((t) => carteOutput(t)).join("")}</div>` : '<p class="m-vide">Aucun output atteint à ce jour.</p>'}
        ${autres.length ? `<h4 class="m-section m-section-2">Autres outputs <span class="m-section-n">${autres.length}</span></h4>
          <div class="m-cartes">${autres.map((t) => carteOutput(t)).join("")}</div>` : ""}</section>`;

      // zones : carte uniquement pour le Big Win 1 (BW 1.1 et BW 1.2)
      if (!/^BW 1\./.test(b.code)) return;
      const pz = outputsParZone(o);
      const lignes = d.zones.map((z) => ({ nom: z.nom, type: z.type === "LS" ? "Learning site" : z.type === "IS" ? "Implementation support" : z.type, l: pz.get(z.id) || [] }));
      lignes.push({ nom: "Transversal", type: "niveau pays / organisation", l: o.filter((t) => !(d.zonesParOutput.get(t.id) || []).length) });
      const atZ = at.filter((t) => (d.zonesParOutput.get(t.id) || []).length);
      h += `<section class="m-diapo">${enteteBW(b, a, dp, "Zones d’intervention")}
        <div class="m-deux"><div class="m-carte">${carteSVG(couleursZonesM(o), { titre: "Zones " + b.code, fs: 9 })}
          ${o.some((t) => (d.zonesParOutput.get(t.id) || []).length) ? "" : '<span class="m-transv">Outputs transversaux : aucune zone d’intervention ciblée</span>'}${legendeCarte()}</div>
        <div><h4 class="m-section">Outputs par zone <span class="m-section-n">${o.length}</span></h4>
          ${lignes.map((z) => {
            const c = compter(z.l, Object.keys(STATUTS_OUT));
            return `<div class="m-zl"><div><b>${esc(z.nom)}</b><small>${esc(z.type)}</small></div>
              ${z.l.length ? `<span class="m-gros">${c.atteint}/${z.l.length}</span><div>${barreM(segsOut(c), z.l.length)}<small>${resumeOut(c)}</small></div>` : '<span class="m-vide">Aucun output</span>'}</div>`;
          }).join("")}
          <h5 class="m-sous-titre">Outputs atteints dans les zones</h5>
          ${atZ.length ? `<ul class="m-liste">${atZ.map((t) => `<li>${esc(objectifOut(t))} <small>${(d.zonesParOutput.get(t.id) || []).map((id) => esc(d.zoneById.get(id).nom)).join(", ")}</small></li>`).join("")}</ul>` : '<p class="m-vide">Aucun output localisé n’est encore atteint.</p>'}
        </div></div></section>`;
    });

    // 5. À retenir
    const enCours = acts.filter((t) => t.statut === "en_cours");
    const nonDem = acts.filter((t) => t.statut === "non_demarree");
    const reportees = acts.filter((t) => ["reportee", "annulee"].includes(t.statut));
    const bwDe = (t) => codeBW(d.bwById.get(d.stratById.get(t.strategy_id).big_win_id));
    const chiffres = outs.filter((t) => t.statut === "atteint" && chiffreCle(t) && chiffreCle(t) !== "Fait").slice(0, 6);
    h += `<section class="m-diapo" id="m-retenir">${entete("À retenir", "Synthèse " + CFG.annee + filtre)}
      <h2 class="m-titre">À retenir</h2><div class="m-retenir">
      <div class="m-ret"><div class="m-ret-tete"><b style="color:${M.vert}">${ca.completee}</b><span>Acquis<small>activités finalisées sur ${acts.length}</small></span></div>
        <ul><li>${pct(ca.completee, acts.length)} % des activités finalisées (${ca.completee} sur ${acts.length})</li><li>${co.atteint} outputs atteints sur ${outs.length}</li>
        ${chiffres.map((t) => `<li><b>${esc(chiffreCle(t))}</b> ${t.chiffre_libelle ? esc(t.chiffre_libelle) : ": " + esc(objectifOut(t))}</li>`).join("")}</ul></div>
      <div class="m-ret"><div class="m-ret-tete"><b style="color:${M.ambre}">${enCours.length}</b><span>En cours<small>activités</small></span></div>
        <ul>${enCours.map((t) => `<li><b>${esc(bwDe(t))}</b> : ${esc(court(t.libelle, 90))}</li>`).join("") || "<li>Aucune</li>"}</ul></div>
      <div class="m-ret"><div class="m-ret-tete"><b style="color:${M.rouge}">${nonDem.length}</b><span>Non démarrées<small>activités</small></span></div>
        <ul>${nonDem.map((t) => `<li><b>${esc(bwDe(t))}</b> : ${esc(court(t.libelle, 90))}</li>`).join("") || "<li>Aucune</li>"}</ul>
        ${reportees.length ? `<h5 class="m-ret-sous">Reportées / annulées · ${reportees.length}</h5><ul>${reportees.map((t) => `<li><b>${esc(bwDe(t))}</b> : ${esc(court(t.libelle, 90))}</li>`).join("")}</ul>` : ""}</div>
      </div></section>`;

    $("#rapport").innerHTML = h;
    // Chaque diapo appartient à une partie : seule la partie sélectionnée est affichée
    let partie = "", rang = 0;
    $$("#rapport .m-diapo").forEach((el) => {
      if (el.id) { partie = el.id.replace(/^m-/, ""); rang = 0; }
      el.dataset.partie = partie;
      el.dataset.sous = rang++;
      const lib = el.querySelector(".m-entete span");
      el.dataset.titre = lib ? lib.textContent.split("·").pop().trim() : "";
    });
    const parties = [["vue", "Vue d’ensemble"], ["chiffres", "Chiffres clés"]]
      .concat(parBw.map((x) => [`bw-${x.b.id}`, codeBW(x.b)])).concat([["retenir", "À retenir"], ["maj", "Mises à jour"]]);
    if (!parties.some(([k]) => k === S.partie)) S.partie = "vue";
    $("#rap-nav").innerHTML = parties.map(([k, l]) =>
      `<button type="button" role="tab" data-partie="${k}" aria-selected="${k === S.partie}"${k === S.partie ? ' class="actif"' : ""}>${esc(l)}</button>`).join("");
    afficherPartie();

    // Historique
    const hist = d.historique.slice(0, 40);
    $("#historique").innerHTML = hist.length ? hist.map((e) => {
      let quoi = "";
      if (e.objet === "activite") {
        const t = d.activites.find((y) => y.id === e.objet_id);
        quoi = "Activité « " + esc(court(t ? t.libelle : "#" + e.objet_id, 70)) + " »";
      } else if (e.objet === "output") {
        const t = d.outputs.find((y) => y.id === e.objet_id);
        quoi = "Output « " + esc(court(t ? objectifOut(t) : "#" + e.objet_id, 70)) + " »";
      } else {
        const ind = d.indicateurs.find((y) => y.id === e.objet_id);
        quoi = "Indicateur « " + esc(ind ? ind.libelle : "#" + e.objet_id) + " » " + esc(e.champ);
      }
      const lib = (v) => esc(STATUTS_ACT[v] || STATUTS_OUT[v] || court(v, 60) || "vide");
      const change = e.champ === "statut" ? `${lib(e.ancien)} → <b>${lib(e.nouveau)}</b>` :
        e.champ === "creation" ? "<b>ajoutée</b>" : e.objet === "indicateur" ? "= <b>" + esc(e.nouveau) + "</b>" : esc(e.champ) + " modifié";
      return `<li><time>${fmtDate(e.created_at)} · ${esc(e.auteur || "")}</time>${quoi} : ${change}</li>`;
    }).join("") : '<li class="vide">Aucune mise à jour depuis l\'import du fichier Excel.</li>';
  }

  /* ---------- rendu : activités ---------- */
  function renderActivites() {
    const d = S.data;
    const q = ($("#recherche-act").value || "").toLowerCase();
    const fs = $("#filtre-statut-act").value;
    const strats = stratsFiltrees();
    let html = "";
    d.big_wins.forEach((b) => {
      const sb = strats.filter((s) => s.big_win_id === b.id);
      if (!sb.length) return;
      const toutes = activitesDe(sb.map((s) => s.id));
      const nb = toutes.length, fini = toutes.filter((a) => a.statut === "completee").length;
      let corps = "";
      sb.forEach((s) => {
        const acts = d.activites.filter((a) => a.strategy_id === s.id &&
          (!fs || a.statut === fs) && (!q || (a.libelle + " " + (a.commentaire || "")).toLowerCase().includes(q)));
        if (!acts.length && (q || fs)) return;
        const edit = peutModifierStrat(s);
        const deps = (s.departements || []).join(", ") || '<span class="vide">Non précisé</span>';
        const stratCell = `<td class="strat" rowspan="${Math.max(acts.length, 1)}">${esc(court(s.libelle, 140))}
          ${s.realisations ? `<details><summary>Ce qui est réellement fait</summary><p>${esc(s.realisations)}</p></details>` : ""}</td>`;
        if (!acts.length) {
          corps += `<tr>${stratCell}<td colspan="5" class="vide">Aucune activité renseignée</td></tr>`;
          return;
        }
        acts.forEach((a, i) => {
          const statut = edit
            ? `<select class="badge st-${a.statut}" data-act-statut="${a.id}" aria-label="Statut">${Object.entries(STATUTS_ACT).map(([k, v]) => `<option value="${k}"${k === a.statut ? " selected" : ""}>${v}</option>`).join("")}</select>`
            : `<span class="badge st-${a.statut}">${STATUTS_ACT[a.statut]}</span>`;
          const comm = edit
            ? `<textarea class="comm-edit" rows="${Math.min(8, Math.max(2, Math.ceil((a.commentaire || "").length / 45) + (a.commentaire || "").split("\n").length - 1))}" data-act-comm="${a.id}" placeholder="Ajouter un commentaire…">${esc(a.commentaire || "")}</textarea>`
            : esc(a.commentaire || "");
          const maj = a.updated_by && a.updated_by !== "Import Excel" ? `<span class="maj">MàJ ${fmtDate(a.updated_at)} · ${esc(a.updated_by)}</span>` : "";
          corps += `<tr>${i === 0 ? stratCell : ""}<td>${esc(a.libelle)}</td>${i === 0 ? `<td class="dep" rowspan="${acts.length}">${deps}</td>` : ""}
            <td class="ech">${esc(a.echeance || "")}</td><td class="st">${statut}${maj}</td><td class="comm">${comm}</td></tr>`;
        });
      });
      if (!corps) return;
      html += `<tr class="grp"><td colspan="6"><b>${esc(titreBW(b))} :</b> <span class="grp-nom">${esc(b.libelle)}</span><br><small>${nb} activité(s) · ${pct(fini, nb)} % achevées</small></td></tr>` + corps;
    });
    $("#table-activites tbody").innerHTML = html || '<tr><td colspan="6" class="vide">Aucune activité ne correspond aux filtres.</td></tr>';
  }

  /* ---------- rendu : outputs ---------- */
  function chipsZones(o) {
    const z = (S.data.zonesParOutput.get(o.id) || []).map((id) => S.data.zoneById.get(id)).filter(Boolean);
    return z.length ? z.map((x) => `<span class="chip chip-${esc(x.type)}">${esc(x.nom)}</span>`).join("") : '<span class="vide">Transversal</span>';
  }

  const t2 = (x) => (x ? `<span class="out-cle-lib">${esc(x)}</span>` : "");

  function renderOutputs() {
    const d = S.data;
    const outs = outputsFiltres();
    const co = compter(outs, Object.keys(STATUTS_OUT));
    $("#kpis-outputs").innerHTML = Object.entries(STATUTS_OUT).map(([k, v]) =>
      `<div class="kpi" style="--kpi:${COUL[k]}"><div class="kpi-label">${v}</div><div class="kpi-val">${co[k]}</div><div class="kpi-sub">${pct(co[k], outs.length)} % des ${outs.length} outputs</div></div>`).join("");

    const q = ($("#recherche-out").value || "").toLowerCase();
    const fs = $("#filtre-statut-out").value;
    const fz = $("#filtre-zone-out").value;
    let html = "";
    d.big_wins.forEach((b) => {
      const ob = outs.filter((o) => o.big_win_id === b.id);
      const vis = ob.filter((o) => (!fs || o.statut === fs) &&
        (!fz || (fz === "transversal" ? !(d.zonesParOutput.get(o.id) || []).length : (d.zonesParOutput.get(o.id) || []).includes(+fz))) &&
        (!q || [o.cible, o.objectif_clair, o.resultat_clair, o.valeur_realisee, o.commentaire].join(" ").toLowerCase().includes(q)));
      if (!vis.length) return;
      const at = ob.filter((o) => o.statut === "atteint").length;
      html += `<tr class="grp"><td colspan="5"><b>${esc(titreBW(b))} :</b> <span class="grp-nom">${esc(b.libelle)}</span><br><small>${ob.length} output(s) · ${pct(at, ob.length)} % atteints</small></td></tr>`;
      vis.forEach((o) => {
        const edit = peutModifierOutput(o);
        const maj = o.updated_by && o.updated_by !== "Import Excel" ? `<span class="maj">MàJ ${fmtDate(o.updated_at)} · ${esc(o.updated_by)}</span>` : "";
        const res = resultatOut(o), cle = chiffreCle(o);
        html += `<tr><td>${esc(objectifOut(o))}${o.objectif_clair ? `<span class="maj" title="Formulation d'origine">${esc(o.cible)}</span>` : ""}</td>
          <td>${cle && cle !== "Fait" ? `<b class="out-cle">${esc(cle)}</b> ${t2(o.chiffre_libelle)}<br>` : ""}${res ? esc(res) : '<span class="vide">À compléter</span>'}</td>
          <td class="st"><span class="badge st-${o.statut}">${STATUT_SIMPLE[o.statut]}</span>${maj}
            ${edit ? `<br><button class="btn btn-outline btn-small" data-out-edit="${o.id}" style="margin-top:6px">Mettre à jour</button>` : ""}</td>
          <td>${chipsZones(o)}</td><td class="comm">${esc(o.commentaire || "")}</td></tr>`;
      });
    });
    $("#table-outputs tbody").innerHTML = html || '<tr><td colspan="5" class="vide">Aucun output ne correspond aux filtres.</td></tr>';
  }

  /* ---------- rendu : carte & indicateurs ---------- */
  function renderCarte() {
    const d = S.data;
    const bw = $("#carte-bw").value;
    const ind = $("#carte-indic").value;
    const outs = outputsFiltres().filter((o) => !bw || o.big_win_id === +bw);
    const pz = outputsParZone(outs);
    const couleurs = new Map();
    let legende = "";
    const selPer = $("#carte-periode");

    if (ind) {
      const vals = d.indicateur_valeurs.filter((v) => v.indicateur_id === +ind);
      const periodes = [...new Set(vals.map((v) => v.periode))].sort();
      const garde = selPer.value;
      selPer.innerHTML = periodes.map((p) => `<option>${esc(p)}</option>`).join("");
      selPer.hidden = !periodes.length;
      selPer.value = periodes.includes(garde) ? garde : periodes[periodes.length - 1] || "";
      const indic = d.indicateurs.find((x) => x.id === +ind);
      const v = vals.filter((x) => x.periode === selPer.value);
      const nums = v.map((x) => +x.valeur).filter((x) => !isNaN(x));
      const min = Math.min(...nums), max = Math.max(...nums);
      v.forEach((x) => {
        let t = max > min ? (x.valeur - min) / (max - min) : 1;
        if (indic.sens === "baisse") t = 1 - t;
        const fill = `color-mix(in srgb, #0b2e59 ${Math.round(15 + 85 * t)}%, #5bc0eb)`;
        couleurs.set(x.zone_id, { fill, txt: "#071f3d", valeur: x.valeur + (indic.unite ? " " + indic.unite : "") });
      });
      legende = nums.length
        ? `<span><i style="background:color-mix(in srgb,#0b2e59 15%,#5bc0eb)"></i>${indic.sens === "baisse" ? "plus élevé" : "plus faible"}</span><span><i style="background:#0b2e59"></i>${indic.sens === "baisse" ? "plus faible" : "plus élevé"}</span><span>${esc(indic.libelle)} · ${esc(selPer.value)}</span>`
        : "<span>Aucune valeur saisie pour cet indicateur.</span>";
    } else {
      selPer.hidden = true;
      pz.forEach((list, zid) => { const e = etatZone(list); couleurs.set(zid, { fill: ZONE_COUL[e], txt: ZONE_TXT[e] }); });
      legende = [["atteint", "Majorité des outputs atteints"], ["en_cours", "En cours / partiellement atteints"], ["non_atteint", "Non atteints"], ["non_renseigne", "Non renseignés"]]
        .map(([k, l]) => `<span><i style="background:${ZONE_COUL[k]}"></i>${l}</span>`).join("") + '<span><i style="background:var(--carte-fond)"></i>Hors zone</span>';
    }
    $("#grande-carte").innerHTML = carteSVG(couleurs, { grand: true });
    $("#legende-carte").innerHTML = legende;

    // Tableau par zone
    let t = `<div class="table-wrap"><table class="recap"><thead><tr><th>Zone</th><th>Type</th><th>Outputs</th><th>Atteints</th><th></th></tr></thead><tbody>`;
    d.zones.forEach((z) => {
      const l = pz.get(z.id) || [];
      const c = compter(l, Object.keys(STATUTS_OUT));
      t += `<tr><td>${esc(z.nom)}</td><td><span class="chip chip-${esc(z.type)}">${esc(z.type === "LS" ? "Learning site" : z.type === "IS" ? "Implementation support" : z.type)}</span></td>
        <td>${l.length}</td><td>${c.atteint}</td><td style="width:35%">${l.length ? stackBar(c, Object.keys(STATUTS_OUT), l.length) : ""}</td></tr>`;
    });
    const transv = outs.filter((o) => !(d.zonesParOutput.get(o.id) || []).length);
    t += `<tr><td>Transversal</td><td></td><td>${transv.length}</td><td>${transv.filter((o) => o.statut === "atteint").length}</td><td></td></tr></tbody></table></div>`;
    $("#table-zones").innerHTML = t;

    // Indicateurs
    if (!d.indicateurs.length) {
      $("#indicateurs").innerHTML = `<p class="muted">Aucun indicateur n'est encore défini. Les indicateurs à suivre par zone (Ziniaré, Manga, Zorgho)
        seront ajoutés dans la table <code>indicateurs</code> ; leurs valeurs s'afficheront ici et sur la carte.</p>`;
      return;
    }
    const per = [...new Set(d.indicateur_valeurs.map((v) => v.periode))].sort();
    const dernier = per[per.length - 1];
    let h = `<div class="table-wrap"><table class="recap"><thead><tr><th>Indicateur</th>${d.zones.map((z) => `<th>${esc(z.nom)}</th>`).join("")}<th></th></tr></thead><tbody>`;
    d.indicateurs.forEach((i) => {
      h += `<tr><td>${esc(i.libelle)}${i.unite ? ` <span class="vide">(${esc(i.unite)})</span>` : ""}</td>` +
        d.zones.map((z) => {
          const vs = d.indicateur_valeurs.filter((v) => v.indicateur_id === i.id && v.zone_id === z.id);
          const v = vs[vs.length - 1];
          return `<td>${v ? `<b>${esc(v.valeur)}</b>${v.cible != null ? ` <span class="vide">/ ${esc(v.cible)}</span>` : ""}<span class="maj">${esc(v.periode)}</span>` : '<span class="vide">–</span>'}</td>`;
        }).join("") +
        `<td>${!lectureSeule() ? `<button class="btn btn-outline btn-small" data-ind-edit="${i.id}">Saisir</button>` : ""}</td></tr>`;
    });
    $("#indicateurs").innerHTML = h + `</tbody></table></div>${dernier ? `<p class="notes">Dernière période saisie : ${esc(dernier)}.</p>` : ""}`;
  }

  /* ---------- bandeau & filtres ---------- */
  function renderBandeau() {
    const b = $("#bandeau");
    const dep = S.data.departements.find((x) => x.code === S.session.dep);
    const nom = esc(dep ? dep.libelle : S.session.dep);
    if (lectureSeule()) {
      b.className = "bandeau lecture";
      b.innerHTML = `Connecté en <b>consultation</b> : lecture seule. Utilisez le code de votre département pour mettre à jour.`;
    } else {
      b.className = "bandeau";
      b.innerHTML = `Connecté pour <b>${nom}</b> : ${estAdmin() ? "vous pouvez mettre à jour toutes les activités et tous les outputs." : "vous pouvez mettre à jour les activités de votre structure."}`;
    }
    if (S.chargeA) {
      b.innerHTML += ` <span class="bandeau-maj" title="Le tableau de bord se met à jour automatiquement dès qu'une activité ou un output est modifié.">· Données à jour à ${S.chargeA.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>`;
    }
    $("#btn-nouvelle").hidden = lectureSeule();
  }

  function remplirFiltres() {
    const d = S.data;
    const sel = $("#filtre-dep");
    const v = sel.value;
    sel.innerHTML = '<option value="">Tous les départements</option>' +
      d.departements.filter((x) => !["ADMIN", "MEL"].includes(x.code) && d.strategies.some((s) => (s.departements || []).includes(x.code)))
        .map((x) => `<option value="${esc(x.code)}">${esc(x.libelle)}</option>`).join("");
    sel.value = v;
    const opt = (o) => Object.entries(o).map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
    if ($("#filtre-statut-act").options.length === 1) $("#filtre-statut-act").insertAdjacentHTML("beforeend", opt(STATUTS_ACT));
    if ($("#filtre-statut-out").options.length === 1) $("#filtre-statut-out").insertAdjacentHTML("beforeend", opt(STATUTS_OUT));
    const fz = $("#filtre-zone-out"), fzv = fz.value;
    fz.innerHTML = '<option value="">Toutes les zones</option>' + d.zones.map((z) => `<option value="${z.id}">${esc(z.nom)}</option>`).join("") + '<option value="transversal">Transversal</option>';
    fz.value = fzv;
    const cb = $("#carte-bw"), cbv = cb.value;
    cb.innerHTML = '<option value="">Tous les Big Wins</option>' + d.big_wins.map((b) => `<option value="${b.id}" title="${esc(nomBW(b))}">${esc(court(nomBW(b), 80))}</option>`).join("");
    cb.value = cbv;
    const ci = $("#carte-indic"), civ = ci.value;
    ci.innerHTML = '<option value="">État des outputs</option>' + d.indicateurs.map((i) => `<option value="${i.id}">${esc(i.libelle)}</option>`).join("");
    ci.value = civ;
  }

  function renderTout() {
    renderBandeau();
    renderStats();
    renderActivites();
    renderOutputs();
    renderCarte();
  }

  function allerA(tab) {
    S.tab = tab;
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    $$(".bottom-nav button").forEach((t) => t.classList.toggle("active", t.dataset.goto === tab));
    $$(".tab-panel").forEach((p) => (p.hidden = p.id !== "tab-" + tab));
    try { localStorage.setItem("bigwin_tab", tab); } catch (e) { /* ignoré */ }
    window.scrollTo({ top: 0 });
  }

  /* ---------- actions ---------- */
  async function majActivite(id, champs) {
    const a = S.data.activites.find((x) => x.id === id);
    try {
      const r = await rpc("maj_activite", {
        p_code: S.session.code, p_id: id,
        p_statut: champs.statut || null, p_commentaire: champs.commentaire != null ? champs.commentaire : null, p_echeance: null,
      });
      const ancien = a.statut;
      Object.assign(a, r);
      if (champs.statut && champs.statut !== ancien) {
        S.data.historique.unshift({ objet: "activite", objet_id: id, big_win_id: S.data.stratById.get(a.strategy_id).big_win_id, champ: "statut", ancien, nouveau: r.statut, auteur: r.updated_by, created_at: r.updated_at });
      }
      toast(champs.statut ? "Statut enregistré · tableau de bord mis à jour" : "Commentaire enregistré · tableau de bord mis à jour");
      S.chargeA = new Date();
      renderBandeau();
      renderStats();
      renderOutputs();
      renderCarte();
      if (champs.statut) renderActivites();
      S.empreinte = await lireEmpreinte();
    } catch (e) {
      toast(e.message, true);
      renderActivites();
    }
  }

  function ouvrir(dlg) { dlg.showModal(); }
  function fermerDialogues() { $$("dialog[open]").forEach((d) => d.close()); }

  function ouvrirNouvelle() {
    if (lectureSeule()) { toast("Accès en consultation seulement", true); return; }
    const d = S.data;
    const strats = d.strategies.filter(peutModifierStrat);
    const bws = d.big_wins.filter((b) => strats.some((s) => s.big_win_id === b.id));
    if (!bws.length) { toast("Aucune stratégie n'est rattachée à votre département", true); return; }
    $("#na-bw").innerHTML = bws.map((b) => `<option value="${b.id}" title="${esc(nomBW(b))}">${esc(court(nomBW(b), 80))}</option>`).join("");
    const majStrat = () => {
      $("#na-strat").innerHTML = strats.filter((s) => s.big_win_id === +$("#na-bw").value).map((s) => `<option value="${s.id}">${esc(court(s.libelle, 90))}</option>`).join("");
    };
    $("#na-bw").onchange = majStrat;
    majStrat();
    $("#na-statut").innerHTML = Object.entries(STATUTS_ACT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    $("#na-statut").value = "non_demarree";
    $("#na-libelle").value = ""; $("#na-echeance").value = ""; $("#na-comm").value = ""; $("#na-err").textContent = "";
    ouvrir($("#dlg-nouvelle"));
  }

  function ouvrirOutput(id) {
    const o = S.data.outputs.find((x) => x.id === id);
    $("#form-output").dataset.id = id;
    $("#out-cible").textContent = o.cible;
    $("#out-statut").innerHTML = Object.entries(STATUTS_OUT).map(([k, v]) => `<option value="${k}"${k === o.statut ? " selected" : ""}>${v}</option>`).join("");
    $("#out-valeur").value = o.valeur_realisee || "";
    $("#out-comm").value = o.commentaire || "";
    $("#out-cle").value = o.valeur_cle || "";
    $("#out-cle").placeholder = "auto : " + (extraireChiffre(o.valeur_realisee) || (o.statut === "atteint" ? "Fait" : "vide"));
    $("#form-output").dataset.valeurInitiale = o.valeur_realisee || "";
    $("#form-output").dataset.cleInitiale = o.valeur_cle || "";
    $("#out-court").value = o.libelle_court || "";
    $("#out-obj").value = o.objectif_clair || "";
    $("#out-res").value = o.resultat_clair || "";
    $("#out-lib").value = o.chiffre_libelle || "";
    $("#form-output").dataset.resInitial = o.resultat_clair || "";
    const zs = S.data.zonesParOutput.get(o.id) || [];
    $("#out-zones").innerHTML = S.data.zones.map((z) => `<label><input type="checkbox" value="${z.id}"${zs.includes(z.id) ? " checked" : ""}> ${esc(z.nom)}</label>`).join("");
    $("#out-err").textContent = "";
    ouvrir($("#dlg-output"));
  }

  function ouvrirIndicateur(id) {
    const i = S.data.indicateurs.find((x) => x.id === id);
    $("#form-indic").dataset.id = id;
    $("#ind-titre").textContent = i.libelle + (i.unite ? " (" + i.unite + ")" : "");
    $("#ind-zone").innerHTML = S.data.zones.map((z) => `<option value="${z.id}">${esc(z.nom)}</option>`).join("");
    $("#ind-valeur").value = ""; $("#ind-cible").value = ""; $("#ind-err").textContent = "";
    ouvrir($("#dlg-indic"));
  }

  function verrouiller(message) {
    S.data = null;
    ecrireSession(null);
    document.body.classList.add("verrouille");
    $("#login-err").textContent = message || "";
    $("#login-code").value = "";
    setTimeout(() => $("#login-code").focus(), 0);
  }

  async function rafraichir(msg) {
    if (!S.session) { verrouiller(); return; }
    try {
      await charger();
      document.body.classList.remove("verrouille");
      remplirFiltres();
      renderTout();
      if (msg) toast(msg);
    } catch (e) {
      if (/code d.acc/i.test(e.message)) { verrouiller("Code d'accès invalide ou modifié. Reconnectez-vous."); return; }
      if (!S.data) { verrouiller("Connexion impossible : " + e.message); return; }
      $("#erreur").hidden = false;
      $("#erreur").textContent = "Impossible de charger les données : " + e.message;
    }
  }

  function brancher() {
    $$(".tab").forEach((t) => t.addEventListener("click", () => allerA(t.dataset.tab)));
    $$(".bottom-nav button").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.goto === "nouvelle") { allerA("activites"); ouvrirNouvelle(); } else allerA(b.dataset.goto);
    }));
    $("#btn-refresh").addEventListener("click", () => rafraichir("Données actualisées"));
    $("#rapport").addEventListener("click", (e) => {
      const el = e.target.closest("[data-voir-dep]");
      if (!el) return;
      e.stopPropagation();
      S.dep = el.dataset.voirDep;
      $("#filtre-dep").value = S.dep;
      $("#filtre-statut-act").value = el.dataset.voirStatut || "";
      $("#recherche-act").value = "";
      renderTout();
      allerA("activites");
      toast("Activités : " + $("#filtre-dep").selectedOptions[0].textContent + (el.dataset.voirStatut ? " · " + STATUTS_ACT[el.dataset.voirStatut] : ""));
    });
    $("#rap-sous").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sous]");
      if (!b) return;
      S.sous = +b.dataset.sous;
      afficherPartie();
      window.scrollTo({ top: 0 });
    });
    $("#rap-nav").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-partie]");
      if (!b) return;
      S.partie = b.dataset.partie;
      S.sous = 0;
      afficherPartie();
      $("#tab-stats").scrollIntoView({ block: "start" });
      window.scrollTo({ top: 0 });
    });
    $("#filtre-dep").addEventListener("change", (e) => { S.dep = e.target.value; renderTout(); });
    ["#recherche-act", "#filtre-statut-act"].forEach((s) => $(s).addEventListener("input", renderActivites));
    ["#recherche-out", "#filtre-statut-out", "#filtre-zone-out"].forEach((s) => $(s).addEventListener("input", renderOutputs));
    ["#carte-bw", "#carte-indic", "#carte-periode"].forEach((s) => $(s).addEventListener("change", renderCarte));
    $$("[data-close]").forEach((b) => b.addEventListener("click", fermerDialogues));

    $("#btn-login").addEventListener("click", () => { verrouiller(); toast("Déconnecté"); });
    $("#form-login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = $("#login-code").value.trim();
      if (!code) return;
      const bouton = $("#form-login button[type=submit]");
      bouton.disabled = true;
      $("#login-err").textContent = "";
      try {
        const dep = await rpc("verifier_acces", { p_code: code });
        if (!dep) { $("#login-err").textContent = "Code d'accès invalide."; return; }
        ecrireSession({ dep, code });
        await rafraichir();
      } catch (err) {
        $("#login-err").textContent = "Connexion impossible : " + err.message;
      } finally {
        bouton.disabled = false;
      }
    });
    $("#btn-nouvelle").addEventListener("click", ouvrirNouvelle);

    // Tableau des activités : statut et commentaire modifiables en place
    $("#table-activites").addEventListener("change", (e) => {
      const s = e.target.closest("[data-act-statut]");
      if (s) { s.className = "badge st-" + s.value; majActivite(+s.dataset.actStatut, { statut: s.value }); }
    });
    $("#table-activites").addEventListener("focusout", (e) => {
      const t = e.target.closest("[data-act-comm]");
      if (!t) return;
      const a = S.data.activites.find((x) => x.id === +t.dataset.actComm);
      if ((a.commentaire || "") !== t.value) majActivite(a.id, { commentaire: t.value });
    });
    $("#table-outputs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-out-edit]");
      if (b) ouvrirOutput(+b.dataset.outEdit);
    });
    $("#indicateurs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ind-edit]");
      if (b) ouvrirIndicateur(+b.dataset.indEdit);
    });

    $("#form-nouvelle").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const r = await rpc("ajouter_activite", {
          p_code: S.session.code, p_strategy_id: +$("#na-strat").value, p_libelle: $("#na-libelle").value,
          p_statut: $("#na-statut").value, p_echeance: $("#na-echeance").value || null, p_commentaire: $("#na-comm").value || null,
        });
        fermerDialogues();
        await rafraichir();
        toast("Activité ajoutée");
        return r;
      } catch (err) { $("#na-err").textContent = err.message; }
    });

    $("#form-output").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = +e.target.dataset.id;
      try {
        await rpc("maj_output", {
          p_code: S.session.code, p_id: id, p_statut: $("#out-statut").value,
          p_valeur: $("#out-valeur").value, p_commentaire: $("#out-comm").value,
          p_zones: $$("#out-zones input:checked").map((c) => +c.value),
          // valeur réalisée modifiée sans toucher au chiffre clé : le chiffre clé repasse en automatique
          p_valeur_cle: ($("#out-valeur").value !== e.target.dataset.valeurInitiale && $("#out-cle").value === e.target.dataset.cleInitiale)
            ? "" : $("#out-cle").value,
          p_libelle_court: $("#out-court").value,
          p_objectif_clair: $("#out-obj").value,
          p_chiffre_libelle: $("#out-lib").value,
          // valeur réalisée modifiée sans réécrire le résultat en clair : on affiche la nouvelle valeur
          p_resultat_clair: ($("#out-valeur").value !== e.target.dataset.valeurInitiale && $("#out-res").value === e.target.dataset.resInitial)
            ? "" : $("#out-res").value,
        });
        fermerDialogues();
        await rafraichir();
        toast("Output enregistré");
      } catch (err) { $("#out-err").textContent = err.message; }
    });

    $("#form-indic").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await rpc("maj_indicateur_valeur", {
          p_code: S.session.code, p_indicateur_id: +e.target.dataset.id, p_zone_id: +$("#ind-zone").value,
          p_periode: $("#ind-periode").value.trim(), p_valeur: +$("#ind-valeur").value,
          p_cible: $("#ind-cible").value === "" ? null : +$("#ind-cible").value,
        });
        fermerDialogues();
        await rafraichir();
        toast("Valeur enregistrée");
      } catch (err) { $("#ind-err").textContent = err.message; }
    });
  }

  // Pas de rechargement pendant une saisie (commentaire en cours, fenêtre ouverte)
  function saisieEnCours() {
    const el = document.activeElement;
    return !!$("dialog[open]") || (el && /^(TEXTAREA|INPUT|SELECT)$/.test(el.tagName) && el.closest(".tab-panel"));
  }

  async function verifierMaj() {
    if (!S.session || !S.data || document.hidden || S.verifEnCours) return;
    S.verifEnCours = true;
    try {
      const e = await lireEmpreinte();
      if (e && S.empreinte && e !== S.empreinte) {
        if (saisieEnCours()) { S.majEnAttente = true; return; }
        S.majEnAttente = false;
        await rafraichir("Tableau de bord mis à jour avec les dernières modifications");
      }
    } finally {
      S.verifEnCours = false;
    }
  }

  async function demarrer() {
    $$("[data-annee]").forEach((e) => (e.textContent = CFG.annee));
    brancher();
    let tab = "stats";
    try { tab = localStorage.getItem("bigwin_tab") || "stats"; } catch (e) { /* ignoré */ }
    allerA(["stats", "activites", "outputs", "carte"].includes(tab) ? tab : "stats");
    if (S.session) $("#rapport").innerHTML = '<div class="chargement">Chargement des données…</div>';
    try {
      await chargerCarte();
    } catch (e) { /* la carte reste vide */ }
    await rafraichir();
    setInterval(verifierMaj, 30000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) verifierMaj(); });
    window.addEventListener("focus", verifierMaj);
    // une mise à jour mise en attente pendant une saisie est appliquée dès la fin de la saisie
    document.addEventListener("focusout", () => setTimeout(() => { if (S.majEnAttente && !saisieEnCours()) verifierMaj(); }, 300));
  }

  demarrer();
})();
