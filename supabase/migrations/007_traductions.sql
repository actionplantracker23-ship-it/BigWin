-- Traductions FR / EN des données (activités, stratégies, Big Wins, outputs).
-- Une traduction n'est utilisée que si le texte d'origine n'a pas changé (colonne source).
create table if not exists public.traductions (
  objet    text not null,
  objet_id int  not null,
  champ    text not null,
  lang     text not null check (lang in ('fr','en')),
  texte    text not null,
  source   text not null,
  primary key (objet, objet_id, champ, lang)
);
alter table public.traductions enable row level security;
revoke all on public.traductions from anon, authenticated;
-- charger_donnees renvoie aussi « traductions » (voir définition sur le projet Supabase).
-- Les textes traduits sont stockés uniquement dans Supabase (données privées, non versionnées).
