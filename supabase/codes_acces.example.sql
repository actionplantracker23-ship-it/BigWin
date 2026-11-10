-- Exemple : définir les codes d'accès (à exécuter dans l'éditeur SQL Supabase).
-- Ne jamais committer les vrais codes. Les codes sont stockés hachés (bcrypt).
insert into public.codes_acces(departement, code_hash)
select d, extensions.crypt(c, extensions.gen_salt('bf'))
from (values ('ADMIN', 'CHANGER-MOI'), ('Program', 'CHANGER-MOI'), ('PAC', 'CHANGER-MOI')) v(d, c)
on conflict (departement) do update set code_hash = excluded.code_hash;
