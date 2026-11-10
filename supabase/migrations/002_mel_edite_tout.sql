-- Le département MEL (suivi-évaluation) peut, comme ADMIN, mettre à jour toutes les activités et tous les outputs.
create or replace function public._exiger_acces(p_code text, p_departements text[])
returns text
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
  if d not in ('ADMIN', 'MEL') and not (d = any(coalesce(p_departements, '{}'))) then
    raise exception 'Ce département (%) ne peut pas modifier cet élément', d using errcode = '42501';
  end if;
  return d;
end;
$$;
revoke execute on function public._exiger_acces(text, text[]) from public, anon, authenticated;
