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
  const ZONE_COUL = { atteint: "#1e9e4f", en_cours: "#f0b429", non_atteint: "#e05263", non_renseigne: "#c9c2a4" };
  const ZONE_TXT = { atteint: "#0b6b31", en_cours: "#a86a00", non_atteint: "#c21f3a", non_renseigne: "#6b6450" };

  const S = {
    data: null,
    carte: null,
    tab: "stats",
    dep: "",
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

  // Reconstitue l'évolution du % (activités complétées / outputs atteints) à partir du journal.
  function serie(objet, items, cible, bwId) {
    const evts = S.data.historique
      .filter((h) => h.objet === objet && h.champ === "statut" && (bwId == null || h.big_win_id === bwId))
      .filter((h) => items.some((i) => i.id === h.objet_id))
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const etat = new Map(items.map((i) => [i.id, i.statut]));
    const val = () => pct([...etat.values()].filter((st) => st === cible).length, items.length);
    let cur = val();
    const pts = [{ t: Date.now(), v: cur }];
    evts.forEach((h) => {            // du plus récent au plus ancien
      pts.push({ t: new Date(h.created_at).getTime(), v: cur });
      etat.set(h.objet_id, h.ancien); // on annule l'événement
      cur = val();
    });
    const plusAncien = evts.length ? new Date(evts[evts.length - 1].created_at).getTime() : Date.now();
    pts.push({ t: plusAncien - 864e5 * 7, v: cur }); // situation de départ (import Excel)
    return pts.reverse();
  }

  function evolution(sA, sO) {
    const W = 230, H = 116, L = 34, R = 8, T = 18, B = 22;
    const tous = sA.concat(sO).map((p) => p.t);
    let t0 = Math.min(...tous), t1 = Math.max(...tous);
    if (t1 - t0 < 864e5) t0 = t1 - 864e5 * 30;
    const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
    const y = (v) => T + (1 - v / 100) * (H - T - B);
    const grille = [0, 50, 100].map((v) =>
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#9aa1a9" stroke-dasharray="${v ? "1.5 3" : "0"}" stroke-width="${v ? 1 : 1.2}"/>` +
      `<text x="${L - 4}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="#667079">${v} %</text>`).join("");
    const ligne = (s, c) => {
      const d = s.map((p, i) => (i ? "L" : "M") + x(p.t).toFixed(1) + "," + y(p.v).toFixed(1)).join("");
      return `<path d="${d}" fill="none" stroke="${c}" stroke-width="2"/>` +
        s.map((p) => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.2" fill="${c}"><title>${p.v} % · ${new Date(p.t).toLocaleDateString("fr-FR")}</title></circle>`).join("");
    };
    const mois = (t) => new Date(t).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const fin = sA[sA.length - 1].v, finO = sO[sO.length - 1].v;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Activités complétées ${fin} %, outputs atteints ${finO} %">${grille}` +
      `<text x="${L}" y="${H - 6}" font-size="10" fill="#667079">${mois(t0)}</text>` +
      `<text x="${W - R}" y="${H - 6}" font-size="10" fill="#667079" text-anchor="end">${mois(t1)}</text>` +
      ligne(sO, "var(--c-out)") + ligne(sA, "var(--c-act)") +
      `<text x="${W - R}" y="${y(fin) - 6}" font-size="11" font-weight="700" text-anchor="end" fill="var(--c-act)">${fin} %</text>` +
      `<text x="${W - R}" y="${y(finO) + 14}" font-size="11" font-weight="700" text-anchor="end" fill="var(--c-out)">${finO} %</text>` +
      "</svg>";
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
      const fs = opts.grand ? 15 : 13;
      const label = esc(z.nom) + (opts.grand && c.valeur != null ? " · " + esc(c.valeur) : "");
      svg += `<text class="zone-label" x="${x + 7}" y="${y - 6}" font-size="${fs}" fill="${c.txt}">${label}</text>`;
    });
    return svg + "</svg>";
  }

  /* ---------- rendu : statistiques ---------- */
  function renderStats() {
    const d = S.data;
    const strats = stratsFiltrees();
    const acts = activitesDe(strats.map((s) => s.id));
    const outs = outputsFiltres();
    const ca = compter(acts, Object.keys(STATUTS_ACT));
    const co = compter(outs, Object.keys(STATUTS_OUT));
    const renseignes = outs.length - co.non_renseigne;

    $("#kpis").innerHTML = [
      { l: "Activités", v: acts.length, s: strats.length + " stratégies", c: "var(--vert)" },
      { l: "Complétées", v: ca.completee, s: pct(ca.completee, acts.length) + " % des activités", c: "var(--st-ok)" },
      { l: "En cours", v: ca.en_cours, s: pct(ca.en_cours, acts.length) + " %", c: "var(--st-wip)" },
      { l: "Non démarrées", v: ca.non_demarree, s: pct(ca.non_demarree, acts.length) + " %" + (ca.reportee + ca.annulee ? " · " + (ca.reportee + ca.annulee) + " reportée(s)/annulée(s)" : ""), c: "var(--st-ko)" },
      { l: "Outputs atteints", v: co.atteint + " / " + outs.length, s: co.partiel + " partiellement · " + co.en_cours + " en cours", c: "var(--c-out)" },
      { l: "Taux d'atteinte", v: pct(co.atteint, renseignes) + " %", s: "hors " + co.non_renseigne + " non renseignés", c: "var(--c-act)" },
    ].map((k) => `<div class="kpi" style="--kpi:${k.c}"><div class="kpi-label">${k.l}</div><div class="kpi-val">${k.v}</div><div class="kpi-sub">${esc(k.s)}</div></div>`).join("");

    // Intro rédigée à partir des données
    const parBw = d.big_wins.map((b) => {
      const sids = strats.filter((s) => s.big_win_id === b.id).map((s) => s.id);
      const a = activitesDe(sids);
      const o = outs.filter((x) => x.big_win_id === b.id);
      return { b, a, o, sids };
    }).filter((x) => x.a.length || x.o.length || !S.dep);
    const meilleurs = parBw.filter((x) => x.a.length).sort((p, q) => pct(compter(q.a, ["completee"]).completee, q.a.length) - pct(compter(p.a, ["completee"]).completee, p.a.length));
    const top = meilleurs[0], bas = meilleurs[meilleurs.length - 1];
    const zonesActives = d.zones.filter((z) => outs.some((o) => (d.zonesParOutput.get(o.id) || []).includes(z.id)));
    $("#intro").innerHTML =
      `Ce tableau présente <b>l'état de mise en œuvre des ${parBw.length} Big Wins et leviers stratégiques ${CFG.annee}</b>${S.dep ? " du département <b>" + esc(S.dep) + "</b>" : ""} au ${esc(CFG.pays)}. ` +
      `Sur ${acts.length} activités planifiées, <b>${ca.completee} sont complétées (${pct(ca.completee, acts.length)} %)</b>, ${ca.en_cours} sont en cours et ${ca.non_demarree} n'ont pas démarré. ` +
      `${co.atteint} des ${outs.length} outputs sont atteints, ${co.non_renseigne} restent à renseigner. ` +
      (top && bas && top !== bas ? `${esc(titreBW(top.b))} est le plus avancé, ${esc(titreBW(bas.b))} le moins avancé. ` : "") +
      (zonesActives.length ? `Les outputs sont mis en œuvre dans ${zonesActives.length} zones : ${zonesActives.map((z) => esc(z.nom)).join(", ")}.` : "");

    // Lignes « planet »
    let html = `<div class="planet-head"><div>Big Win<sup>1</sup></div><div></div>
      <div><span class="c-act">Activités</span> et <span class="c-out">outputs</span><br><small>évolution<sup>2</sup></small></div>
      <div>Zones d'intervention<br><small>état des outputs<sup>3</sup> : <span class="c-ok">atteint</span> / <span class="c-wip">en cours</span> / <span class="c-ko">non atteint</span></small></div></div>`;
    parBw.forEach(({ b, a, o }, i) => {
      const cA = compter(a, Object.keys(STATUTS_ACT));
      const cO = compter(o, Object.keys(STATUTS_OUT));
      const sA = serie("activite", a, "completee", b.id);
      const sO = serie("output", o, "atteint", b.id);
      const pz = outputsParZone(o);
      const couleurs = new Map();
      pz.forEach((list, zid) => { const e = etatZone(list); couleurs.set(zid, { fill: ZONE_COUL[e], txt: ZONE_TXT[e] }); });
      const transversaux = o.filter((x) => !(d.zonesParOutput.get(x.id) || []).length).length;
      html += `<div class="planet-row">
        <div class="leaf" style="--bw:${esc(b.couleur)}">${esc(b.code.replace(" (politiques)", ""))}<small>${b.code.includes("politiques") ? "politiques" : a.length + " act."}</small></div>
        <div class="planet-text">
          ${b.objectif_organisationnel ? `<div class="bw-org">${esc(b.objectif_organisationnel)}</div>` : ""}
          <h3><b>${i + 1}. ${esc(titreBW(b))}</b> (${a.length} activités · ${o.length} outputs)</h3>
          <p>${esc(nettoie(b.libelle))}</p>
          <div class="bars">
            <div class="bar-line"><span class="lbl">Activités</span>${a.length ? stackBar(cA, Object.keys(STATUTS_ACT), a.length) : '<span class="vide">aucune</span>'}<span class="pct" style="color:var(--c-act)">${pct(cA.completee, a.length)} %</span></div>
            <div class="bar-line"><span class="lbl">Outputs</span>${o.length ? stackBar(cO, Object.keys(STATUTS_OUT), o.length) : '<span class="vide">aucun</span>'}<span class="pct" style="color:var(--c-out)">${pct(cO.atteint, o.length)} %</span></div>
          </div>
        </div>
        <div class="evo">${a.length || o.length ? evolution(a.length ? sA : [{ t: Date.now() - 1, v: 0 }, { t: Date.now(), v: 0 }], o.length ? sO : [{ t: Date.now() - 1, v: 0 }, { t: Date.now(), v: 0 }]) : ""}</div>
        <div class="mini-map">${carteSVG(couleurs, { titre: "Zones " + titreBW(b) })}
          ${transversaux ? `<div class="evo-vide">+ ${transversaux} output(s) transversal(aux)</div>` : ""}</div>
      </div>`;
    });
    $("#planet").innerHTML = html;

    // Récap par département
    const deps = d.departements.filter((x) => !["ADMIN", "MEL"].includes(x.code));
    let tot = { completee: 0, en_cours: 0, non_demarree: 0, autre: 0, n: 0 };
    let rows = deps.map((dep) => {
      const sids = d.strategies.filter((s) => (s.departements || []).includes(dep.code)).map((s) => s.id);
      const a = activitesDe(sids);
      if (!a.length) return "";
      const c = compter(a, Object.keys(STATUTS_ACT));
      return `<tr><td>${esc(dep.libelle)}</td><td>${c.completee}</td><td>${c.en_cours}</td><td>${c.non_demarree}</td><td>${a.length}</td>
        <td style="width:30%">${stackBar(c, Object.keys(STATUTS_ACT), a.length)}</td><td><b>${pct(c.completee, a.length)} %</b></td></tr>`;
    }).join("");
    const all = d.activites;
    const ct = compter(all, Object.keys(STATUTS_ACT));
    tot = all.length;
    $("#recap-dep").innerHTML = `<div class="table-wrap"><table class="recap"><thead><tr><th>Département</th><th>Complétées</th><th>En cours</th><th>Non dém.</th><th>Total</th><th></th><th>%</th></tr></thead>
      <tbody>${rows}<tr class="total"><td>Total (activités uniques)</td><td>${ct.completee}</td><td>${ct.en_cours}</td><td>${ct.non_demarree}</td><td>${tot}</td><td>${stackBar(ct, Object.keys(STATUTS_ACT), tot)}</td><td>${pct(ct.completee, tot)} %</td></tr></tbody></table></div>
      <p class="notes">Une activité portée par plusieurs départements (ex. « Program, PAC ») est comptée pour chacun.</p>`;

    // Historique
    const h = d.historique.slice(0, 40);
    $("#historique").innerHTML = h.length ? h.map((e) => {
      let quoi = "";
      if (e.objet === "activite") {
        const a = d.activites.find((x) => x.id === e.objet_id);
        quoi = "Activité « " + esc(court(a ? a.libelle : "#" + e.objet_id, 70)) + " »";
      } else if (e.objet === "output") {
        const o = d.outputs.find((x) => x.id === e.objet_id);
        quoi = "Output « " + esc(court(o ? o.cible : "#" + e.objet_id, 70)) + " »";
      } else {
        const ind = d.indicateurs.find((x) => x.id === e.objet_id);
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
        (!q || [o.cible, o.valeur_realisee, o.commentaire].join(" ").toLowerCase().includes(q)));
      if (!vis.length) return;
      const at = ob.filter((o) => o.statut === "atteint").length;
      html += `<tr class="grp"><td colspan="5"><b>${esc(titreBW(b))} :</b> <span class="grp-nom">${esc(b.libelle)}</span><br><small>${ob.length} output(s) · ${pct(at, ob.length)} % atteints</small></td></tr>`;
      vis.forEach((o) => {
        const edit = peutModifierOutput(o);
        const maj = o.updated_by && o.updated_by !== "Import Excel" ? `<span class="maj">MàJ ${fmtDate(o.updated_at)} · ${esc(o.updated_by)}</span>` : "";
        html += `<tr><td>${esc(o.cible)}</td><td>${o.valeur_realisee ? esc(o.valeur_realisee) : '<span class="vide">À compléter</span>'}</td>
          <td class="st"><span class="badge st-${o.statut}">${STATUTS_OUT[o.statut]}</span>${maj}
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
        const fill = `color-mix(in srgb, #00843d ${Math.round(25 + 75 * t)}%, #f6e7a8)`;
        couleurs.set(x.zone_id, { fill, txt: "#0b4f26", valeur: x.valeur + (indic.unite ? " " + indic.unite : "") });
      });
      legende = nums.length
        ? `<span><i style="background:color-mix(in srgb,#00843d 25%,#f6e7a8)"></i>${indic.sens === "baisse" ? "plus élevé" : "plus faible"}</span><span><i style="background:#00843d"></i>${indic.sens === "baisse" ? "plus faible" : "plus élevé"}</span><span>${esc(indic.libelle)} · ${esc(selPer.value)}</span>`
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
      toast(champs.statut ? "Statut enregistré" : "Commentaire enregistré");
      renderStats();
      if (champs.statut) renderActivites();
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

  async function demarrer() {
    $$("[data-annee]").forEach((e) => (e.textContent = CFG.annee));
    brancher();
    let tab = "stats";
    try { tab = localStorage.getItem("bigwin_tab") || "stats"; } catch (e) { /* ignoré */ }
    allerA(["stats", "activites", "outputs", "carte"].includes(tab) ? tab : "stats");
    if (S.session) $("#planet").innerHTML = '<div class="chargement">Chargement des données…</div>';
    try {
      await chargerCarte();
    } catch (e) { /* la carte reste vide */ }
    await rafraichir();
  }

  demarrer();
})();
