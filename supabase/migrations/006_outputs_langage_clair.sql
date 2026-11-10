-- Outputs en langage simple : objectif, résultat et explication du chiffre clé
alter table public.outputs add column if not exists objectif_clair text;
alter table public.outputs add column if not exists resultat_clair text;
alter table public.outputs add column if not exists chiffre_libelle text;
-- maj_output accepte p_objectif_clair, p_resultat_clair, p_chiffre_libelle
-- (définition complète appliquée sur le projet Supabase, même corps que 004 avec ces trois champs en plus)
