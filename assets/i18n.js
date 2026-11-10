/* Traduction de l'interface FR → EN (les données sont traduites à part, via la table « traductions »).
   L'interface est écrite en français ; en anglais, chaque texte affiché est remplacé à la volée. */
(function () {
  "use strict";

  // Textes exacts (après suppression des espaces en début et fin)
  const D = {
    // barre du haut, connexion, onglets
    "Tableau de bord": "Dashboard", "· Big Wins": "· Big Wins", "Big Wins": "Big Wins",
    "Suivi de la mise en œuvre · accès réservé. Saisissez le code d'accès de votre département.":
      "Implementation tracking · restricted access. Enter your department's access code.",
    "Code d'accès": "Access code", "Se connecter": "Sign in", "Se déconnecter": "Sign out", "Actualiser": "Refresh",
    "Code d'accès invalide.": "Invalid access code.",
    "Statistiques": "Statistics", "Synthèse des activités": "Activity summary", "Outputs": "Outputs",
    "Carte & indicateurs": "Map & indicators", "Nouvelle activité": "New activity", "Activités": "Activities", "Carte": "Map",
    "Tous les départements": "All departments", "Tous les statuts": "All statuses", "Toutes les zones": "All zones",
    "Tous les Big Wins": "All Big Wins", "État des outputs": "Output status",
    "Connecté pour": "Signed in for", "Connecté en": "Signed in for", "consultation": "viewing",
    ": vous pouvez mettre à jour toutes les activités et tous les outputs.": ": you can update all activities and outputs.",
    ": vous pouvez mettre à jour les activités de votre structure.": ": you can update your department's activities.",
    ": lecture seule. Utilisez le code de votre département pour mettre à jour.": ": read only. Use your department's code to make updates.",
    "Administrateur MEL": "MEL administrator", "Consultation": "Viewing",
    // départements
    "Programme": "Programme", "PAC (Plaidoyer)": "PAC (Advocacy)", "Digital Health": "Digital Health",
    "PEI (Innovation)": "PEI (Innovation)", "People & Culture": "People & Culture",
    "Finance & Administration": "Finance & Administration",
    // rapport : parties
    "Vue d’ensemble": "Overview", "Chiffres clés": "Key figures", "À retenir": "Key takeaways", "Mises à jour": "Updates",
    "Activités finalisées": "Completed activities", "Outputs atteints": "Outputs achieved", "Zones d’intervention": "Intervention areas",
    "Zones d'intervention": "Intervention areas", "Toutes les Big Wins": "All Big Wins",
    "Big Win": "Big Win", "Avancement": "Progress", "Finalisées": "Completed", "En cours": "In progress", "Non dém.": "Not started",
    "Reportées": "Postponed", "Total": "Total", "Big Wins et enablers": "Big Wins and enablers",
    "Activités planifiées": "Planned activities", "Taux de réalisation des activités (%) par Big Win": "Activity completion rate (%) by Big Win",
    "Répartition des activités par statut": "Activities by status", "Non démarrées": "Not started", "finalisées": "completed",
    "Activités Big Win à mettre en œuvre": "Big Win activities to implement",
    "Activités par département : nombre, statut et taux d'achèvement": "Activities by department: number, status and completion rate",
    "Département": "Department", "Fin.": "Done", "Report.": "Postp.", "Achèv.": "Compl.",
    "Total (sans double compte)": "Total (no double counting)", "Autres outputs": "Other outputs",
    "Objectif": "Objective", "Résultat": "Result", "Objectif atteint": "Objective achieved", "Partiellement atteint": "Partially achieved",
    "Pas encore atteint": "Not yet achieved", "Résultat à renseigner": "Result to be reported", "Pas encore renseigné": "Not reported yet",
    "Fait": "Done", "Outputs par zone": "Outputs by area", "Transversal": "Cross-cutting",
    "niveau pays / organisation": "country / organisation level", "Learning site": "Learning site",
    "Implementation support": "Implementation support", "Aucun output": "No output",
    "Outputs atteints dans les zones": "Outputs achieved in the areas",
    "Aucun output localisé n’est encore atteint.": "No output in the areas has been achieved yet.",
    "Aucune activité finalisée à ce jour.": "No activity completed yet.", "Aucun output atteint à ce jour.": "No output achieved yet.",
    "Majorité atteints": "Mostly achieved", "En cours / partiel": "In progress / partial", "Non atteints": "Not achieved",
    "Non renseignés": "Not reported", "Hors zone": "Outside the areas", "Acquis": "Achievements", "activités": "activities",
    "Aucune": "None", "Reportées / annulées": "Postponed / cancelled", "Dernières mises à jour": "Latest updates",
    "Aucune mise à jour depuis l'import du fichier Excel.": "No updates since the Excel import.",
    // synthèse des activités
    "Plan des Big Wins": "Big Wins plan", "État détaillé de la mise en œuvre, par Big Win, par stratégie et par activité":
      "Detailed implementation status, by Big Win, strategy and activity",
    "Rechercher une activité…": "Search activities…", "+ Nouvelle activité": "+ New activity", "Stratégie": "Strategy",
    "Activité": "Activity", "Département(s)": "Department(s)", "Échéance": "Deadline", "Statut": "Status", "Commentaires": "Comments",
    "Ce qui est réellement fait": "What was actually done", "Ajouter un commentaire…": "Add a comment…",
    "Aucune activité renseignée": "No activity recorded", "Non précisé": "Not specified",
    "Aucune activité ne correspond aux filtres.": "No activity matches the filters.",
    "Complétée": "Completed", "Non démarrée": "Not started", "Reportée": "Postponed", "Annulée": "Cancelled",
    // outputs
    "Niveau d'atteinte des outputs et zones d'intervention concernées": "Output achievement and intervention areas",
    "Rechercher un output…": "Search outputs…", "Zones": "Areas", "Commentaire": "Comment", "Mettre à jour": "Update",
    "Atteint": "Achieved", "Non atteint": "Not achieved", "Non renseigné": "Not reported", "À compléter": "To be completed",
    "Aucun output ne correspond aux filtres.": "No output matches the filters.", "Formulation d'origine": "Original wording",
    // carte et indicateurs
    "Par zone": "By area", "Indicateurs": "Indicators", "Zone": "Area", "Type": "Type", "Atteints": "Achieved",
    "Aucun indicateur n'est encore défini. Les indicateurs à suivre par zone (Ziniaré, Manga, Zorgho)": "No indicator has been defined yet. Indicators to track by area (Ziniaré, Manga, Zorgho)",
    "seront ajoutés dans la table": "will be added to the table", "; leurs valeurs s'afficheront ici et sur la carte.": "; their values will appear here and on the map.",
    "Majorité des outputs atteints": "Most outputs achieved", "En cours / partiellement atteints": "In progress / partially achieved",
    "Saisir": "Enter", "Période": "Period", "Valeur": "Value", "Cible": "Target", "plus faible": "lower", "plus élevé": "higher",
    "Aucune valeur saisie pour cet indicateur.": "No value entered for this indicator.",
    // fenêtres
    "Mettre à jour l'output": "Update output", "Valeur réalisée (donnée brute)": "Achieved value (raw data)",
    "Objectif, en langage simple": "Objective, in plain language", "Résultat, en langage simple": "Result, in plain language",
    "Chiffre clé affiché": "Key figure shown", "Ce que mesure ce chiffre": "What this figure measures",
    "Zones d'intervention ": "Intervention areas", "Annuler": "Cancel", "Enregistrer": "Save",
    "Stratégie ": "Strategy", "Valeur d'indicateur": "Indicator value",
    // messages
    "Statut enregistré · tableau de bord mis à jour": "Status saved · dashboard updated",
    "Commentaire enregistré · tableau de bord mis à jour": "Comment saved · dashboard updated",
    "Tableau de bord mis à jour avec les dernières modifications": "Dashboard updated with the latest changes",
    "Données actualisées": "Data refreshed", "Déconnecté": "Signed out", "Activité ajoutée": "Activity added",
    "Output enregistré": "Output saved", "Valeur enregistrée": "Value saved", "Chargement des données…": "Loading data…",
    "Accès en consultation seulement": "View-only access",
    "Le tableau de bord se met à jour automatiquement dès qu'une activité ou un output est modifié.":
      "The dashboard updates automatically whenever an activity or output changes.",
    "Voir ces activités dans la synthèse des activités": "See these activities in the activity summary",
    "Voir et mettre à jour les activités de ce département": "See and update this department's activities",
    "Parties du rapport": "Report sections", "Volets du Big Win": "Big Win sections", "Filtrer par département": "Filter by department",
    "Filtrer par statut": "Filter by status", "Filtrer par zone": "Filter by area", "Indicateur": "Indicator",
    "Rechercher une activité": "Search activities", "Rechercher un output": "Search outputs",
    "Carte des zones d'intervention": "Map of intervention areas", "Synthèse": "Summary",
    "Langue": "Language",
    ": cible et réalisé": ": target and achieved",
    "Aucun indicateur n'est encore défini. Les indicateurs à suivre par zone (Ziniaré, Manga, Zorgho) seront ajoutés dans la table":
      "No indicator has been defined yet. Indicators to track by area (Ziniaré, Manga, Zorgho) will be added to the table",
    "atteint": "achieved", "non atteint": "not achieved", "non renseigné": "not reported", "partiellement atteint": "partially achieved",
    "reportées / annulées": "postponed / cancelled", "reportées": "postponed", "non démarrées": "not started",
    "Les téléphones sont réparés en 2 jours en moyenne": "Phones are repaired in 2 days on average",
    "Réparer les téléphones des agents en moins de 3 jours": "Repair workers' phones in under 3 days",
    "délai moyen de réparation": "average repair time", "83 % ou Fait": "83% or Done", "Q4 2026": "Q4 2026", "2026-T4": "2026-Q4",
  };

  const PLURIEL = (n, s, p) => (+n > 1 ? p : s);
  // Règles avec nombres (texte entier)
  const R = [
    [/^\/(\d+) activités finalisées \((\d+) %\)$/, (m, a, b) => `/${a} activities completed (${b}%)`],
    [/^(\d+) activités finalisées sur (\d+)$/, (m, a, b) => `${a} activities completed out of ${b}`],
    [/^activités finalisées sur (\d+)$/, (m, a) => `activities completed out of ${a}`],
    [/^(\d+) outputs atteints sur (\d+)$/, (m, a, b) => `${a} outputs achieved out of ${b}`],
    [/^(\d+) % des activités finalisées \((\d+) sur (\d+)\)$/, (m, a, b, c) => `${a}% of activities completed (${b} out of ${c})`],
    [/^(\d+) % des (\d+) outputs$/, (m, a, b) => `${a}% of the ${b} outputs`],
    [/^(\d+) activité\(s\)$/, (m, a) => `${a} ${PLURIEL(a, "activity", "activities")}`],
    [/^(\d+) output\(s\)$/, (m, a) => `${a} ${PLURIEL(a, "output", "outputs")}`],
    [/^(\d+) % achevées$/, (m, a) => `${a}% completed`],
    [/^(\d+) % atteints$/, (m, a) => `${a}% achieved`],
    [/^(\d+) (atteints?)$/, (m, a) => `${a} achieved`],
    [/^(\d+) (partiels?|partiellement atteints?)$/, (m, a) => `${a} partial`],
    [/^(\d+) en cours$/, (m, a) => `${a} in progress`],
    [/^(\d+) non atteints?$/, (m, a) => `${a} not achieved`],
    [/^(\d+) non renseignés?$/, (m, a) => `${a} not reported`],
    [/^(\d+) finalisées$/, (m, a) => `${a} completed`],
    [/^(\d+) non démarrées?$/, (m, a) => `${a} not started`],
    [/^(\d+) reportées?( \/ annulées)?$/, (m, a) => `${a} postponed`],
    [/^en cours$/, () => "in progress"], [/^non démarrées?$/, () => "not started"], [/^reportées?$/, () => "postponed"],
    [/^Activités finalisées · (\d+)$/, (m, a) => `Completed activities · ${a}`],
    [/^(En cours|Non démarrées|Reportées \/ annulées|Autres outputs) · (\d+)$/, (m, a, b) => `${t(a)} · ${b}`],
    [/^(BW [\d.]+|SE \d) · (Activités finalisées|Outputs atteints|Zones d’intervention)$/, (m, a, b) => `${a} · ${t(b)}`],
    [/^Synthèse (\d{4})$/, (m, a) => `Summary ${a}`],
    [/^Plan des Big Wins (\d{4})$/, (m, a) => `Big Wins plan ${a}`],
    [/^Outputs (\d{4}) : cible et réalisé$/, (m, a) => `Outputs ${a}: target and achieved`],
    [/^(\d+) outputs atteints$/, (m, a) => `${a} outputs achieved`],
    [/^outputs atteints$/, () => "outputs achieved"],
    [/^Données à jour à (.+)$/, (m, a) => `Data up to date at ${a}`],
    [/^· Données à jour à (.+)$/, (m, a) => `· Data up to date at ${a}`],
    [/^MàJ (.+) · (.+)$/, (m, a, b) => `Updated ${a} · ${b}`],
    [/^Connecté : (.+)$/, (m, a) => `Signed in: ${a}`],
    [/^Activités : (.+)$/, (m, a) => `Activities: ${a.split(" · ").map(t).join(" · ")}`],
    [/^Activité « (.*) » : (.*)$/s, (m, a, b) => `Activity “${a}”: ${t(b.replace(/ →\s*$/, ""))}${/→\s*$/.test(b) ? " →" : ""}`],
    [/^Output « (.*) » : (.*)$/s, (m, a, b) => `Output “${a}”: ${t(b.replace(/ →\s*$/, ""))}${/→\s*$/.test(b) ? " →" : ""}`],
    [/^(.+) → $/, (m, a) => `${t(a)} → `],
    [/^Zones (BW [\d.]+)$/, (m, a) => `Areas ${a}`],
    [/^Mots les plus fréquents : (.+)$/, (m, a) => `Most frequent words: ${a}`],
    [/^auto : (.+)$/, (m, a) => `auto: ${t(a)}`],
    [/^ex\. (.+)$/, (m, a) => `e.g. ${t(a)}`],
    [/^(Atteint|En cours|Non atteint|Non renseigné|Partiellement atteint|Finalisées|finalisées|en cours|non démarrées|Non démarrées|Reportées|reportées|reportées \/ annulées|Reportées \/ annulées|atteint|partiellement atteint|non atteint|non renseigné) : (.+)$/,
      (m, a, b) => `${t(a)}: ${b}`],
  ];

  function t(texte) {
    if (texte == null) return texte;
    const brut = String(texte);
    const s = brut.trim().replace(/\s+/g, " ");
    if (!s) return brut;
    // séparateur « · » en début ou fin de texte (ex. « en cours · »)
    let m = s.match(/^(.+?) ·$/);
    if (m) { const x = t(m[1]); return x === m[1] ? brut : brut.replace(brut.trim(), x + " ·"); }
    m = s.match(/^· (.+)$/);
    if (m && D[s] === undefined) { const x = t(m[1]); return x === m[1] ? brut : brut.replace(brut.trim(), "· " + x); }
    let r = D[s];
    if (r === undefined) {
      for (const [re, f] of R) { const m = s.match(re); if (m) { r = f(...m); break; } }
    }
    if (r === undefined && s.includes(" · ")) {
      const parts = s.split(" · ");
      const tr = parts.map((p) => t(p));
      if (tr.some((x, i) => x !== parts[i])) r = tr.join(" · ");
    }
    if (r === undefined && /^[^,]+(, [^,]+)+$/.test(s) && /\d/.test(s)) { // listes « 12 finalisées, 2 en cours »
      const parts = s.split(", ");
      const tr = parts.map((p) => t(p));
      if (tr.some((x, i) => x !== parts[i])) r = tr.join(", ");
    }
    if (r === undefined) return brut;
    const debut = brut.match(/^\s*/)[0], fin = brut.match(/\s*$/)[0];
    return debut + r + fin;
  }

  const ATTRS = ["placeholder", "title", "aria-label"];
  let lang = "fr";
  let observateur = null;

  function traduireNoeud(racine) {
    if (lang !== "en") return;
    const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    let n;
    const liste = [];
    while ((n = w.nextNode())) liste.push(n);
    if (racine.nodeType === 3) liste.push(racine);
    liste.forEach((n) => {
      if (n.parentElement && n.parentElement.closest("[data-notr], textarea, script, style")) return;
      if (n.__fr === undefined) n.__fr = n.nodeValue;
      const v = t(n.__fr);
      if (v !== n.nodeValue) n.nodeValue = v;
    });
    const els = racine.nodeType === 1 ? [racine, ...racine.querySelectorAll("[placeholder],[title],[aria-label]")] : [];
    els.forEach((el) => ATTRS.forEach((a) => {
      if (!el.hasAttribute || !el.hasAttribute(a) || el.closest("[data-notr]")) return;
      const k = "__fr_" + a;
      if (el[k] === undefined) el[k] = el.getAttribute(a);
      const v = t(el[k]);
      if (v !== el.getAttribute(a)) el.setAttribute(a, v);
    }));
  }

  function restaurer() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) if (n.__fr !== undefined) { n.nodeValue = n.__fr; delete n.__fr; }
    document.querySelectorAll("[placeholder],[title],[aria-label]").forEach((el) => ATTRS.forEach((a) => {
      const k = "__fr_" + a;
      if (el[k] !== undefined) { el.setAttribute(a, el[k]); delete el[k]; }
    }));
  }

  function observer() {
    if (observateur) observateur.disconnect();
    if (lang !== "en") return;
    observateur = new MutationObserver((muts) => {
      observateur.disconnect();
      muts.forEach((m) => {
        if (m.type === "childList") m.addedNodes.forEach((x) => traduireNoeud(x));
        else if (m.type === "characterData") { const n = m.target; n.__fr = n.nodeValue; traduireNoeud(n); }
        else if (m.type === "attributes") { const el = m.target; delete el["__fr_" + m.attributeName]; traduireNoeud(el); }
      });
      observateur.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    });
    observateur.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function definir(l) {
    lang = l === "en" ? "en" : "fr";
    document.documentElement.lang = lang;
    if (lang === "en") traduireNoeud(document.body); else restaurer();
    observer();
    document.querySelectorAll("[data-lang-btn]").forEach((b) => {
      b.textContent = lang === "en" ? "FR" : "EN";
      b.setAttribute("aria-label", lang === "en" ? "Passer en français" : "Switch to English");
      b.title = b.getAttribute("aria-label");
    });
  }

  window.I18N = { t, definir, get lang() { return lang; } };
})();
