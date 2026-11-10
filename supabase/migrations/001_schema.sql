-- Big Wins 2026 Burkina Faso : schéma de suivi des activités et des outputs
-- Lecture publique (clé publishable), écriture uniquement via les fonctions RPC
-- protégées par un code d'accès par département.

create extension if not exists pgcrypto with schema extensions;

-- Référentiels -------------------------------------------------------------

create table public.departements (
  code    text primary key,
  libelle text not null,
  ordre   int  not null default 0
);

-- Codes d'accès (hachés) : jamais exposés à l'API publique
create table public.codes_acces (
  departement text primary key references public.departements(code) on delete cascade,
  code_hash   text not null
);

create table public.big_wins (
  id      serial primary key,
  code    text unique not null,          -- BW 1.1, BW 2, SE 1 ...
  libelle text not null,
  ordre   int  not null default 0,
  couleur text not null default '#00843d'
);

create table public.strategies (
  id                  serial primary key,
  big_win_id          int not null references public.big_wins(id) on delete cascade,
  ordre               int not null default 0,
  libelle             text not null,
  departement_label   text,              -- libellé d'origine du fichier Excel
  departements        text[] not null default '{}',
  realisations        text,              -- « Ce qui est réellement fait »
  ref_source          text               -- ligne de la feuille « BF Review - Statut »
);

create table public.activites (
  id           serial primary key,
  strategy_id  int not null references public.strategies(id) on delete cascade,
  ordre        int not null default 0,
  libelle      text not null,
  statut       text not null default 'non_demarree'
               check (statut in ('completee','en_cours','non_demarree','reportee','annulee')),
  echeance     text,
  commentaire  text,
  updated_at   timestamptz not null default now(),
  updated_by   text
);

create table public.zones (
  id        serial primary key,
  code      text unique not null,
  nom       text not null,
  type      text not null check (type in ('LS','IS','National','Autre')),
  province  text,                         -- nom de la province sur la carte
  lat       double precision,
  lon       double precision,
  ordre     int not null default 0
);

create table public.outputs (
  id              serial primary key,
  big_win_id      int not null references public.big_wins(id) on delete cascade,
  strategy_id     int references public.strategies(id) on delete set null,
  ref_source      text,
  ordre           int not null default 0,
  cible           text not null,
  valeur_realisee text,
  statut          text not null default 'non_renseigne'
                  check (statut in ('atteint','partiel','en_cours','non_atteint','non_renseigne')),
  commentaire     text,
  updated_at      timestamptz not null default now(),
  updated_by      text
);

create table public.output_zones (
  output_id int references public.outputs(id) on delete cascade,
  zone_id   int references public.zones(id) on delete cascade,
  primary key (output_id, zone_id)
);

-- Indicateurs (à compléter) : valeurs par zone et par période, pour la carte
create table public.indicateurs (
  id          serial primary key,
  code        text unique not null,
  libelle     text not null,
  unite       text,
  sens        text not null default 'hausse' check (sens in ('hausse','baisse')),
  big_win_id  int references public.big_wins(id) on delete set null,
  output_id   int references public.outputs(id) on delete set null,
  ordre       int not null default 0
);

create table public.indicateur_valeurs (
  id            serial primary key,
  indicateur_id int not null references public.indicateurs(id) on delete cascade,
  zone_id       int not null references public.zones(id) on delete cascade,
  periode       text not null,             -- ex. 2026-T3
  valeur        numeric,
  cible         numeric,
  updated_at    timestamptz not null default now(),
  updated_by    text,
  unique (indicateur_id, zone_id, periode)
);

-- Journal des mises à jour
create table public.historique (
  id          bigserial primary key,
  objet       text not null,               -- activite | output | indicateur
  objet_id    int  not null,
  big_win_id  int,
  champ       text not null,
  ancien      text,
  nouveau     text,
  auteur      text,
  created_at  timestamptz not null default now()
);

create index on public.strategies(big_win_id);
create index on public.activites(strategy_id);
create index on public.outputs(big_win_id);
create index on public.outputs(strategy_id);
create index on public.output_zones(zone_id);
create index on public.indicateurs(big_win_id);
create index on public.indicateurs(output_id);
create index on public.indicateur_valeurs(zone_id);
create index on public.historique(objet, objet_id);
create index on public.historique(created_at);

-- Sécurité : lecture seule pour tous, écriture via RPC ---------------------

alter table public.departements       enable row level security;
alter table public.codes_acces        enable row level security;
alter table public.big_wins           enable row level security;
alter table public.strategies         enable row level security;
alter table public.activites          enable row level security;
alter table public.zones              enable row level security;
alter table public.outputs            enable row level security;
alter table public.output_zones       enable row level security;
alter table public.indicateurs        enable row level security;
alter table public.indicateur_valeurs enable row level security;
alter table public.historique         enable row level security;

create policy "lecture" on public.departements       for select to anon, authenticated using (true);
create policy "lecture" on public.big_wins           for select to anon, authenticated using (true);
create policy "lecture" on public.strategies         for select to anon, authenticated using (true);
create policy "lecture" on public.activites          for select to anon, authenticated using (true);
create policy "lecture" on public.zones              for select to anon, authenticated using (true);
create policy "lecture" on public.outputs            for select to anon, authenticated using (true);
create policy "lecture" on public.output_zones       for select to anon, authenticated using (true);
create policy "lecture" on public.indicateurs        for select to anon, authenticated using (true);
create policy "lecture" on public.indicateur_valeurs for select to anon, authenticated using (true);
create policy "lecture" on public.historique         for select to anon, authenticated using (true);
-- codes_acces : aucune policy => inaccessible via l'API

revoke all on public.codes_acces from anon, authenticated;

-- Fonctions ---------------------------------------------------------------

-- Renvoie le code du département (ou 'ADMIN') correspondant au code d'accès, sinon null
create or replace function public.verifier_acces(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.departement
  from public.codes_acces c
  where c.code_hash = extensions.crypt(p_code, c.code_hash)
  limit 1;
$$;

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
  if d <> 'ADMIN' and not (d = any(coalesce(p_departements, '{}'))) then
    raise exception 'Ce département (%) ne peut pas modifier cet élément', d using errcode = '42501';
  end if;
  return d;
end;
$$;

create or replace function public.maj_activite(
  p_code text, p_id int, p_statut text, p_commentaire text default null, p_echeance text default null)
returns public.activites
language plpgsql
security definer
set search_path = ''
as $$
declare a public.activites; s public.strategies; d text; r public.activites;
begin
  select * into a from public.activites where id = p_id;
  if not found then raise exception 'Activité introuvable'; end if;
  select * into s from public.strategies where id = a.strategy_id;
  d := public._exiger_acces(p_code, s.departements);

  update public.activites set
    statut      = coalesce(p_statut, statut),
    commentaire = coalesce(p_commentaire, commentaire),
    echeance    = coalesce(p_echeance, echeance),
    updated_at  = now(),
    updated_by  = d
  where id = p_id
  returning * into r;

  if r.statut is distinct from a.statut then
    insert into public.historique(objet, objet_id, big_win_id, champ, ancien, nouveau, auteur)
    values ('activite', p_id, s.big_win_id, 'statut', a.statut, r.statut, d);
  end if;
  if r.commentaire is distinct from a.commentaire then
    insert into public.historique(objet, objet_id, big_win_id, champ, ancien, nouveau, auteur)
    values ('activite', p_id, s.big_win_id, 'commentaire', a.commentaire, r.commentaire, d);
  end if;
  return r;
end;
$$;

create or replace function public.ajouter_activite(
  p_code text, p_strategy_id int, p_libelle text, p_statut text default 'non_demarree',
  p_echeance text default null, p_commentaire text default null)
returns public.activites
language plpgsql
security definer
set search_path = ''
as $$
declare s public.strategies; d text; r public.activites;
begin
  if coalesce(trim(p_libelle), '') = '' then raise exception 'Libellé obligatoire'; end if;
  select * into s from public.strategies where id = p_strategy_id;
  if not found then raise exception 'Stratégie introuvable'; end if;
  d := public._exiger_acces(p_code, s.departements);
  insert into public.activites(strategy_id, ordre, libelle, statut, echeance, commentaire, updated_by)
  values (p_strategy_id,
          (select coalesce(max(ordre), 0) + 1 from public.activites where strategy_id = p_strategy_id),
          trim(p_libelle), coalesce(p_statut, 'non_demarree'), p_echeance, p_commentaire, d)
  returning * into r;
  insert into public.historique(objet, objet_id, big_win_id, champ, ancien, nouveau, auteur)
  values ('activite', r.id, s.big_win_id, 'creation', null, r.statut, d);
  return r;
end;
$$;

create or replace function public.maj_output(
  p_code text, p_id int, p_statut text, p_valeur text default null,
  p_commentaire text default null, p_zones int[] default null)
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

-- Administration : définir / changer un code d'accès (ADMIN uniquement)
create or replace function public.definir_code_acces(p_code_admin text, p_departement text, p_nouveau_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.verifier_acces(p_code_admin) is distinct from 'ADMIN' then
    raise exception 'Réservé à l''administrateur' using errcode = '42501';
  end if;
  if length(coalesce(p_nouveau_code, '')) < 6 then
    raise exception 'Le code doit contenir au moins 6 caractères';
  end if;
  insert into public.codes_acces(departement, code_hash)
  values (p_departement, extensions.crypt(p_nouveau_code, extensions.gen_salt('bf')))
  on conflict (departement) do update set code_hash = excluded.code_hash;
end;
$$;

revoke execute on function public._exiger_acces(text, text[]) from public, anon, authenticated;
grant execute on function public.verifier_acces(text) to anon, authenticated;
grant execute on function public.maj_activite(text, int, text, text, text) to anon, authenticated;
grant execute on function public.ajouter_activite(text, int, text, text, text, text) to anon, authenticated;
grant execute on function public.maj_output(text, int, text, text, text, int[]) to anon, authenticated;
grant execute on function public.maj_indicateur_valeur(text, int, int, text, numeric, numeric) to anon, authenticated;
grant execute on function public.definir_code_acces(text, text, text) to anon, authenticated;
