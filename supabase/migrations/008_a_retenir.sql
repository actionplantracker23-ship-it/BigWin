-- « À retenir » : leçons apprises (5 au plus) et propositions de cibles d'outputs pour les prochaines années (FR / EN)
create table if not exists public.a_retenir (
  id          serial primary key,
  section     text not null check (section in ('lecon','cible')),
  ordre       int  not null default 0,
  sens        text check (sens in ('baisser','relever','reformuler')),
  titre_fr    text, titre_en    text,
  texte_fr    text, texte_en    text,
  cible_fr    text, cible_en    text,
  resultat_fr text, resultat_en text,
  proposition_fr text, proposition_en text
);
alter table public.a_retenir enable row level security;
revoke all on public.a_retenir from anon, authenticated;
-- charger_donnees renvoie aussi « a_retenir ». Le contenu est stocké uniquement dans Supabase (non versionné).
