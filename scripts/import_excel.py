"""Génère supabase/seed.sql à partir du classeur Excel « 2026 BF Big Wins ».

Feuille principale : « Synthèse par Big Win » (stratégies, activités réalisées /
en cours / non démarrées, ce qui est réellement fait). Les outputs viennent de
« Synthèse Outputs » (cible, valeur réalisée, statut, commentaire).

Usage : python3 scripts/import_excel.py chemin/vers/classeur.xlsx > supabase/seed.sql
"""
import json
import re
import sys

import openpyxl

# Big Wins du fichier Excel à ne pas importer (supprimés du tableau de bord à la demande)
BIG_WINS_EXCLUS = {"BW 2 (politiques)"}

BW_COULEURS = {
    # Palette : bleu foncé, bleu ciel, orange, gris
    "BW 1.1": "#0b2e59", "BW 1.2": "#1d5a96", "BW 2": "#2b8cc4",
    "BW 2 (politiques)": "#5bc0eb", "BW 3": "#f28c28", "SE 1": "#d9731a",
    "SE 2": "#6b7480", "SE 3": "#3d4752",
}

DEPARTEMENTS = [
    ("Program", "Programme"), ("PAC", "PAC (Plaidoyer)"), ("DH", "Digital Health"),
    ("PEI", "PEI (Innovation)"), ("P&C", "People & Culture"),
    ("Finance & Admin", "Finance & Administration"), ("MEL", "MEL"),
]

# Zones de mise en œuvre (districts sanitaires). province = forme utilisée sur la carte
# (geoBoundaries ADM2) : la province qui contient le district.
ZONES = [
    # code, nom, type, province, lat, lon
    ("ZINIARE", "Ziniaré", "LS", "Oubritenga", 12.58, -1.30),
    ("MANGA", "Manga", "LS", "Zoundweogo", 11.66, -1.07),
    ("ZORGHO", "Zorgho", "IS", "Ganzourgou", 12.25, -0.62),
]

# Zones attribuées quand le texte de l'output ne cite aucune zone.
# Les outputs sans zone sont transversaux (niveau pays / organisation).
ZONES_PAR_DEFAUT = {"BW 1.1": ["ZINIARE", "MANGA"], "BW 1.2": ["ZORGHO"]}

ZONE_MOTS = {
    "ZINIARE": [r"ziniar"],
    "MANGA": [r"\bmanga\b"],
    "ZORGHO": [r"zorgho"],
}

STATUT_OUTPUT = {
    "atteint": "atteint", "partiellement atteint": "partiel", "en cours": "en_cours",
    "non atteint": "non_atteint", "non renseigné": "non_renseigne",
}

# Ligne « Réf. source » (feuille BF Review - Statut) -> ligne de « Synthèse par Big Win »
REF_VERS_LIGNE = {
    7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: 12, 15: 13, 16: 14,
    22: 15, 23: 16, 24: 17, 25: 18, 29: 19, 33: 20, 35: 21, 39: 22, 40: 22, 41: 23,
}


def propre(t):
    if t is None:
        return None
    t = str(t).replace("\xa0", " ").strip()
    return None if t in ("", "–", "-") else t


def puces(t):
    t = propre(t)
    if not t:
        return []
    out = []
    for ligne in re.split(r"\n\s*•\s*|^\s*•\s*", t):
        ligne = re.sub(r"^\*\s*", "", ligne.strip()).strip()
        if ligne:
            out.append(re.sub(r"\s+", " ", ligne))
    return out


def departements(label):
    if not label:
        return []
    l = label.lower()
    res = []
    if "program" in l:
        res.append("Program")
    if "pac" in l:
        res.append("PAC")
    if re.search(r"\bdh\b", l):
        res.append("DH")
    if "pei" in l:
        res.append("PEI")
    if "p&c" in l:
        res.append("P&C")
    if "finance" in l:
        res.append("Finance & Admin")
    return res


def echeance(libelle):
    m = re.search(r"\((Q[1-4][^)]*|Ongoing[^)]*)\)\s*$", libelle)
    if m:
        return m.group(1).strip()
    m = re.search(r"\b(?:by|par)\s+((?:Q[1-4]|YE|H[12])[\w\s\-,]*\d{2,4})", libelle, re.I)
    return m.group(1).strip() if m else None


def zones_du_texte(*textes):
    brut = " ".join(x for x in textes if x)
    t = brut.lower()
    trouve = [code for code, mots in ZONE_MOTS.items() if any(re.search(m, t) for m in mots)]
    if re.search(r"\bLS\b|\bLSs\b", brut) or "learning site" in t:
        trouve += ["ZINIARE", "MANGA"]
    if re.search(r"\bIS\b", brut) or "implementation support" in t:
        trouve += ["ZORGHO"]
    return sorted(set(trouve))


# Lignes de « BF Review - Statut » : (colonne A = Big Win organisationnel, colonne B = Big Win pays)
LIGNES_NOMS = {
    "BW 1.1": (7, 7), "BW 1.2": (7, 10), "BW 2": (13, 13), "BW 2 (politiques)": (13, 15),
    "BW 3": (20, 20), "SE 1": (24, 24), "SE 2": (25, 25), "SE 3": (39, 39),
}
TITRES = {"BW 2 (politiques)": "Big Win 2 : politiques", "SE 1": "Strategic enabler 1",
          "SE 2": "Strategic enabler 2", "SE 3": "Strategic enabler 3"}


def noms_complets(wb, code, libelle_synthese):
    """Titre court, libellé complet (sans préfixe) et Big Win organisationnel."""
    ws = wb["BF Review - Statut"]
    la, lb = LIGNES_NOMS.get(code, (None, None))
    org = re.sub(r"\s+", " ", propre(ws.cell(la, 1).value) or "").strip() if la else None
    lib = re.sub(r"\s+", " ", propre(ws.cell(lb, 2).value) or libelle_synthese).strip() if lb else libelle_synthese
    m = re.match(r"^(?:Country Functionnal\s+)?((?:Big Win|Strategic enabler)\s*[\d.]+)\s*:\s*(.*)$", lib, re.I)
    titre = TITRES.get(code) or (m.group(1) if m else code)
    if m:
        lib = m.group(2)
    return titre, lib, org or None


def cle_activite(t):
    return re.sub(r"[^a-z0-9]", "", (t or "").lower())[:80]


def commentaires_activites(wb):
    """Commentaires « ce qui est réellement fait » par activité.

    Feuille « BF Review - Statut » : col. O = commentaire des activités complétées (col. K),
    col. P = commentaire des activités en cours (col. L). Quand une ligne a un commentaire P
    mais aucune activité en cours, il complète celui des activités complétées.
    """
    ws = wb["BF Review - Statut"]
    res = {}

    def ajoute(acts, texte):
        texte = (texte or "").strip()
        if not texte:
            return
        for act in acts:
            k = cle_activite(act)
            res[k] = (res[k] + "\n" + texte) if k in res else texte

    for r in range(7, ws.max_row + 1):
        k_acts, l_acts = puces(ws.cell(r, 11).value), puces(ws.cell(r, 12).value)
        o, p = propre(ws.cell(r, 15).value), propre(ws.cell(r, 16).value)
        ajoute(k_acts, o)
        ajoute(l_acts if l_acts else k_acts, p)
    return res


def lire(chemin):
    """Lit le classeur et renvoie un dict prêt à être inséré."""
    wb = openpyxl.load_workbook(chemin, data_only=True)
    ws = wb["Synthèse par Big Win"]
    data = {"departements": [{"code": c, "libelle": l, "ordre": i} for i, (c, l) in enumerate(DEPARTEMENTS)],
            "zones": [{"code": c, "nom": n, "type": t, "province": p, "lat": la, "lon": lo, "ordre": i}
                      for i, (c, n, t, p, la, lo) in enumerate(ZONES)],
            "big_wins": [], "strategies": [], "activites": [], "outputs": []}
    comms = commentaires_activites(wb)
    bw_courant = None
    strat_ordre = {}
    ligne_vers_strat = {}
    for r in range(5, ws.max_row + 1):
        a = propre(ws.cell(r, 1).value)
        if a == "Total":
            break
        if a in BIG_WINS_EXCLUS:
            bw_courant = None  # lignes ignorées jusqu'au Big Win suivant
            continue
        if a:
            bw_courant = a
            lib = re.sub(r"\s+", " ", propre(ws.cell(r, 2).value) or a)
            titre, lib, org = noms_complets(wb, a, lib)
            data["big_wins"].append({"code": a, "titre": titre, "libelle": lib, "objectif_organisationnel": org,
                                     "ordre": len(data["big_wins"]) + 1,
                                     "couleur": BW_COULEURS.get(a, "#0b2e59")})
        if not bw_courant or not propre(ws.cell(r, 3).value):
            continue
        strat_ordre[bw_courant] = strat_ordre.get(bw_courant, 0) + 1
        dep_label = propre(ws.cell(r, 4).value)
        cle = len(data["strategies"]) + 1
        ligne_vers_strat[r] = cle
        data["strategies"].append({
            "cle": cle, "bw": bw_courant, "ordre": strat_ordre[bw_courant],
            "libelle": propre(ws.cell(r, 3).value), "departement_label": dep_label,
            "departements": departements(dep_label), "realisations": propre(ws.cell(r, 7).value),
            "ref_source": "L" + str(r)})
        n = 0
        for col, statut in ((5, "completee"), (8, "en_cours"), (10, "non_demarree")):
            for act in puces(ws.cell(r, col).value):
                n += 1
                data["activites"].append({"strat": cle, "ordre": n, "libelle": act,
                                          "statut": statut, "echeance": echeance(act),
                                          "commentaire": comms.get(cle_activite(act))})

    wo = wb["Synthèse Outputs"]
    for r in range(5, wo.max_row + 1):
        bw = propre(wo.cell(r, 1).value)
        cible = propre(wo.cell(r, 3).value)
        if not bw or not cible:
            continue
        ref = propre(wo.cell(r, 2).value)
        valeur = propre(wo.cell(r, 5).value)
        statut = STATUT_OUTPUT.get((propre(wo.cell(r, 6).value) or "non renseigné").lower(), "non_renseigne")
        comm = propre(wo.cell(r, 7).value)
        ligne = REF_VERS_LIGNE.get(int(ref[1:])) if ref and ref[1:].isdigit() else None
        zones = zones_du_texte(cible, valeur, comm) or ZONES_PAR_DEFAUT.get(bw, [])
        data["outputs"].append({
            "bw": bw, "strat": ligne_vers_strat.get(ligne), "ref_source": ref,
            "ordre": len(data["outputs"]) + 1, "cible": re.sub(r"\s+", " ", cible),
            "valeur_realisee": valeur, "statut": statut, "commentaire": comm,
            "zones": zones})
    return data


SQL = """-- Généré par scripts/import_excel.py : ne pas modifier à la main.
-- Réinitialise les données (le schéma et les codes d'accès sont conservés).
do $seed$
declare j jsonb := $json${json}$json$::jsonb;
begin
  truncate public.historique, public.indicateur_valeurs, public.indicateurs, public.output_zones,
           public.outputs, public.activites, public.strategies, public.big_wins, public.zones
           restart identity cascade;

  insert into public.departements(code, libelle, ordre)
  select code, libelle, ordre from jsonb_to_recordset(j->'departements') as x(code text, libelle text, ordre int)
  on conflict (code) do update set libelle = excluded.libelle, ordre = excluded.ordre;
  insert into public.departements(code, libelle, ordre) values ('ADMIN', 'Administrateur MEL', 99)
  on conflict (code) do nothing;

  insert into public.zones(code, nom, type, province, lat, lon, ordre)
  select * from jsonb_to_recordset(j->'zones')
    as x(code text, nom text, type text, province text, lat float8, lon float8, ordre int);

  insert into public.big_wins(code, titre, libelle, objectif_organisationnel, ordre, couleur)
  select * from jsonb_to_recordset(j->'big_wins')
    as x(code text, titre text, libelle text, objectif_organisationnel text, ordre int, couleur text);

  create temp table _s on commit drop as
  select * from jsonb_to_recordset(j->'strategies') as x(cle int, bw text, ordre int, libelle text,
    departement_label text, departements text[], realisations text, ref_source text);
  alter table _s add column id int;
  insert into public.strategies(big_win_id, ordre, libelle, departement_label, departements, realisations, ref_source)
  select b.id, s.ordre, s.libelle, s.departement_label, s.departements, s.realisations, s.ref_source
  from _s s join public.big_wins b on b.code = s.bw order by s.cle;
  update _s set id = st.id from public.strategies st where st.ref_source = _s.ref_source;

  insert into public.activites(strategy_id, ordre, libelle, statut, echeance, commentaire, updated_by)
  select s.id, a.ordre, a.libelle, a.statut, a.echeance, a.commentaire, 'Import Excel'
  from jsonb_to_recordset(j->'activites') as a(strat int, ordre int, libelle text, statut text, echeance text, commentaire text)
  join _s s on s.cle = a.strat order by a.strat, a.ordre;

  insert into public.outputs(big_win_id, strategy_id, ref_source, ordre, cible, valeur_realisee, statut, commentaire, updated_by)
  select b.id, s.id, o.ref_source, o.ordre, o.cible, o.valeur_realisee, o.statut, o.commentaire, 'Import Excel'
  from jsonb_to_recordset(j->'outputs') as o(bw text, strat int, ref_source text, ordre int, cible text,
       valeur_realisee text, statut text, commentaire text)
  join public.big_wins b on b.code = o.bw left join _s s on s.cle = o.strat order by o.ordre;

  insert into public.output_zones(output_id, zone_id)
  select op.id, z.id
  from jsonb_array_elements(j->'outputs') e
  cross join lateral jsonb_array_elements_text(e->'zones') zc
  join public.outputs op on op.ordre = (e->>'ordre')::int
  join public.zones z on z.code = zc;
end
$seed$;
"""


def main(chemin):
    data = lire(chemin)
    print(SQL.replace("{json}", json.dumps(data, ensure_ascii=False, separators=(",", ":"))), end="")


if __name__ == "__main__":
    main(sys.argv[1])
