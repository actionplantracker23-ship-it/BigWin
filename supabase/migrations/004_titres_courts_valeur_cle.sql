-- Présentation des résultats façon modèle PowerPoint : titres courts (français) et chiffre clé des outputs
alter table public.big_wins   add column if not exists titre_court text;
alter table public.strategies add column if not exists titre_court text;
alter table public.outputs    add column if not exists libelle_court text;
alter table public.outputs    add column if not exists valeur_cle text;   -- grand chiffre affiché (ex. « 83,44 % »)

drop function if exists public.maj_output(text, int, text, text, text, int[]);

create or replace function public.maj_output(
  p_code text, p_id int, p_statut text, p_valeur text default null,
  p_commentaire text default null, p_zones int[] default null,
  p_valeur_cle text default null, p_libelle_court text default null)
returns public.outputs
language plpgsql
security definer
set search_path = ''
as $$
declare o public.outputs; deps text[]; d text; r public.outputs;
begin
  select * into o from public.outputs where id = p_id;
  if not found then raise exception 'Output introuvable'; end if;
  select coalesce(array_agg(distinct x), '{}') into deps
  from public.strategies s, unnest(s.departements) x
  where (o.strategy_id is not null and s.id = o.strategy_id)
     or (o.strategy_id is null and s.big_win_id = o.big_win_id);
  d := public._exiger_acces(p_code, deps);

  update public.outputs set
    statut          = coalesce(p_statut, statut),
    valeur_realisee = coalesce(p_valeur, valeur_realisee),
    commentaire     = coalesce(p_commentaire, commentaire),
    valeur_cle      = case when p_valeur_cle is null then valeur_cle else nullif(trim(p_valeur_cle), '') end,
    libelle_court   = case when p_libelle_court is null then libelle_court else nullif(trim(p_libelle_court), '') end,
    updated_at      = now(),
    updated_by      = d
  where id = p_id
  returning * into r;

  if p_zones is not null then
    delete from public.output_zones where output_id = p_id;
    insert into public.output_zones(output_id, zone_id)
    select p_id, z from unnest(p_zones) z on conflict do nothing;
  end if;

  if r.statut is distinct from o.statut then
    insert into public.historique(objet, objet_id, big_win_id, champ, ancien, nouveau, auteur)
    values ('output', p_id, o.big_win_id, 'statut', o.statut, r.statut, d);
  end if;
  if r.valeur_realisee is distinct from o.valeur_realisee then
    insert into public.historique(objet, objet_id, big_win_id, champ, ancien, nouveau, auteur)
    values ('output', p_id, o.big_win_id, 'valeur', o.valeur_realisee, r.valeur_realisee, d);
  end if;
  return r;
end;
$$;
grant execute on function public.maj_output(text, int, text, text, text, int[], text, text) to anon, authenticated;
