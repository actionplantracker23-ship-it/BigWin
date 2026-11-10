# Big Wins 2026 · Burkina Faso : suivi de la mise en œuvre

Tableau de bord web (GitHub Pages) et base de données (Supabase, projet « Big win ») pour
mettre à jour l'état des activités et des outputs des Big Wins 2026.

Source : classeur « 2026 BF Big Wins 3 MEL PC », feuille principale **« Synthèse par Big Win »**
(stratégies, activités réalisées / en cours / non démarrées, ce qui est réellement fait),
complétée par **« Synthèse Outputs »** (cible, valeur réalisée, statut des 54 outputs).

## Ce que fait la page

| Onglet | Contenu |
|---|---|
| **Statistiques** | Rapport présenté comme le modèle PowerPoint « Mise à jour des Big Wins » : vue d’ensemble, chiffres clés, zones d’intervention, puis pour chaque Big Win les activités finalisées (par stratégie, d’après les commentaires « ce qui a été fait »), les outputs atteints (chiffre clé) et la carte des zones ; enfin « À retenir ». Données en direct |
| **Synthèse des activités** | Tableau par Big Win et stratégie. Une fois connecté, chaque département change le **statut** (complétée, en cours, non démarrée, reportée, annulée) et le **commentaire** de ses activités, ou ajoute une activité |
| **Outputs** | Cible, valeur réalisée, statut, zones et commentaire de chaque output, modifiables par le département responsable |
| **Carte & indicateurs** | Carte du Burkina Faso avec les zones de mise en œuvre (**Ziniaré**, **Manga**, **Zorgho**), tableau par zone, et indicateurs par zone (à ajouter) |

Le filtre « Tous les départements » restreint toutes les vues à un département.

## Accès (privé)

- **Rien n'est visible sans code.** La page s'ouvre sur un écran de connexion ; les tables Supabase
  ne sont lisibles par personne depuis l'API. Les données arrivent uniquement par la fonction
  `charger_donnees(code)`, qui vérifie le code d'accès.
- Les écritures passent par `maj_activite`, `ajouter_activite`, `maj_output`, `maj_indicateur_valeur`,
  qui vérifient aussi le code. Les codes sont stockés hachés (bcrypt) dans `codes_acces`.
- Un département ne modifie que ses stratégies ; `ADMIN` et `MEL` modifient tout ;
  `LECTURE` (consultation) voit tout mais ne modifie rien.
- Chaque changement de statut est tracé dans `historique` (sert aussi aux courbes d'évolution).
- Changer un code : `select definir_code_acces('<code ADMIN>', 'PAC', '<nouveau code>');`

**Aucune information de connexion ni aucune donnée n'est dans ce dépôt** : `assets/config.js`
et `supabase/seed.sql` sont exclus (`.gitignore`). La configuration est générée à la publication
à partir de deux secrets GitHub (Settings → Secrets and variables → Actions → New repository secret) :
`SUPABASE_URL` et `SUPABASE_KEY` (clé *publishable* du projet).

## Base de données

```
supabase/migrations/001_schema.sql   tables, sécurité (RLS), fonctions
supabase/migrations/002_mel_edite_tout.sql
supabase/migrations/003_acces_prive_noms_complets.sql
supabase/seed.sql                    données issues du fichier Excel (généré en local, non versionné)
scripts/import_excel.py              Excel -> seed.sql
scripts/build_map.py                 contours des provinces -> data/bf_provinces.json
```

Tables : `big_wins` (titre, nom complet, Big Win organisationnel) → `strategies` → `activites` ; `outputs` ↔ `output_zones` ↔ `zones` ;
`indicateurs` → `indicateur_valeurs` (valeur par zone et période) ; `departements`, `codes_acces`, `historique`.

Réimporter le fichier Excel (attention : remplace les données et l'historique) :

```bash
python3 scripts/import_excel.py "2026_BF_Big_Wins_3_MEL_PC.xlsx" > supabase/seed.sql
```

puis exécuter `supabase/seed.sql` dans l'éditeur SQL de Supabase.

### Ajouter des indicateurs

```sql
insert into indicateurs (code, libelle, unite, sens, big_win_id)
values ('U5_TRAIT', 'Taux de traitement U5', '%', 'hausse', (select id from big_wins where code = 'BW 1.1'));
```

Les valeurs se saisissent ensuite dans l'onglet « Carte & indicateurs » (bouton « Saisir »),
et la carte se colore par zone selon l'indicateur choisi.

## Carte

Contours des provinces : geoBoundaries (gbOpen, BFA ADM2, CC BY 4.0). Chaque zone de mise en œuvre
est représentée par la province qui contient le district : Ziniaré → Oubritenga, Manga → Zoundwéogo,
Zorgho → Ganzourgou. Pour utiliser des contours de districts sanitaires, remplacer `data/bf_provinces.json`
et la colonne `province` de la table `zones`.

## Publication

Dans **Settings → Pages → Source**, choisir **GitHub Actions**. Chaque push sur `main` publie le site.
En local : copier `assets/config.example.js` en `assets/config.js`, le remplir,
puis `python3 -m http.server` et ouvrir http://localhost:8000.
