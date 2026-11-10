-- 1. Noms complets des Big Wins (feuille « BF Review - Statut », colonnes A et B)
alter table public.big_wins add column if not exists titre text;
alter table public.big_wins add column if not exists objectif_organisationnel text;

-- 2. Accès privé : plus aucune lecture publique des tables.
--    Toutes les données passent par charger_donnees(code), qui exige un code d'accès valide.
do $$
declare t text;
begin
  foreach t in array array['departements','big_wins','strategies','activites','zones','outputs',
                           'output_zones','indicateurs','indicateur_valeurs','historique','codes_acces'] loop
    execute format('drop policy if exists "lecture" on public.%I', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Code de consultation (lecture seule) pour les personnes qui ne mettent rien à jour
insert into public.departements(code, libelle, ordre) values ('LECTURE', 'Consultation', 98)
on conflict (code) do nothing;

create or replace function public.charger_donnees(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare d text;
begin
  d := public.verifier_acces(p_code);
  if d is null then
    raise exception 'Code d''accès invalide' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'departement',        d,
    'departements',       (select coalesce(jsonb_agg(x order by x.ordre), '[]') from public.departements x),
    'big_wins',           (select coalesce(jsonb_agg(x order by x.ordre), '[]') from public.big_wins x),
    'strategies',         (select coalesce(jsonb_agg(x order by x.big_win_id, x.ordre), '[]') from public.strategies x),
    'activites',          (select coalesce(jsonb_agg(x order by x.strategy_id, x.ordre), '[]') from public.activites x),
    'outputs',            (select coalesce(jsonb_agg(x order by x.ordre), '[]') from public.outputs x),
    'zones',              (select coalesce(jsonb_agg(x order by x.ordre), '[]') from public.zones x),
    'output_zones',       (select coalesce(jsonb_agg(x), '[]') from public.output_zones x),
    'indicateurs',        (select coalesce(jsonb_agg(x order by x.ordre), '[]') from public.indicateurs x),
    'indicateur_valeurs', (select coalesce(jsonb_agg(x order by x.periode), '[]') from public.indicateur_valeurs x),
    'historique',         (select coalesce(jsonb_agg(x order by x.created_at desc), '[]')
                           from (select * from public.historique order by created_at desc limit 500) x)
  );
end;
$$;
grant execute on function public.charger_donnees(text) to anon, authenticated;

-- Le code de consultation ne peut rien modifier
create or replace function public.maj_indicateur_valeur(
  p_code text, p_indicateur_id int, p_zone_id int, p_periode text,
  p_valeur numeric, p_cible numeric default null)
returns public.indicateur_valeurs
language plpgsql
security definer
set search_path = ''
as $$
declare d text; r public.indicateur_valeurs;
begin
  d := public.verifier_acces(p_code);
  if d is null then raise exception 'Code d''accès invalide' using errcode = '28000'; end if;
  if d = 'LECTURE' then raise exception 'Accès en consultation seulement' using errcode = '42501'; end if;
  insert into public.indicateur_valeurs(indicateur_id, zone_id, periode, valeur, cible, updated_by)
  values (p_indicateur_id, p_zone_id, p_periode, p_valeur, p_cible, d)
  on conflict (indicateur_id, zone_id, periode) do update
    set valeur = excluded.valeur,
        cible = coalesce(excluded.cible, public.indicateur_valeurs.cible),
        updated_at = now(), updated_by = d
  returning * into r;
  insert into public.historique(objet, objet_id, champ, nouveau, auteur)
  values ('indicateur', p_indicateur_id, p_periode || ' / zone ' || p_zone_id, p_valeur::text, d);
  return r;
end;
$$;
