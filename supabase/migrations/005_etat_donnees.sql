-- Empreinte légère des données : permet à la page de détecter une mise à jour faite par quelqu'un d'autre
create or replace function public.etat_donnees(p_code text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.verifier_acces(p_code) is null then
    raise exception 'Code d''accès invalide' using errcode = '28000';
  end if;
  return concat_ws('|',
    (select count(*) || ':' || coalesce(max(updated_at)::text, '') from public.activites),
    (select count(*) || ':' || coalesce(max(updated_at)::text, '') from public.outputs),
    (select count(*) || ':' || coalesce(max(updated_at)::text, '') from public.indicateur_valeurs),
    (select count(*) from public.output_zones),
    (select count(*) || ':' || coalesce(max(id)::text, '') from public.historique),
    (select count(*) from public.big_wins),
    (select count(*) from public.strategies));
end;
$$;
grant execute on function public.etat_donnees(text) to anon, authenticated;
