-- ---------------------------------------------------------------- OBAVEŠTENJA MEJLOM
-- Vercel funkcija api/notify.js poziva notify_collect sa tajnom (NOTIFY_SECRET)
-- i šalje Dragani mejl. Tajna se upisuje jednom: insert into app_settings ...

create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'notified_at') then
    alter table public.messages add column notified_at timestamptz;
    update public.messages set notified_at = now();
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'observations' and column_name = 'notified_at') then
    alter table public.observations add column notified_at timestamptz;
    update public.observations set notified_at = now();
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reviews' and column_name = 'notified_at') then
    alter table public.reviews add column notified_at timestamptz;
    update public.reviews set notified_at = now();
  end if;
end $$;

-- p: { secret, kind: 'message' | 'all' }  ->  nova (još neprijavljena) dešavanja
create or replace function public.notify_collect(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s text;
  kind text := coalesce(p->>'kind', 'all');
  msgs jsonb := '[]'::jsonb;
  obs jsonb := '[]'::jsonb;
  revs jsonb := '[]'::jsonb;
begin
  select value into s from app_settings where key = 'notify_secret';
  if s is null or length(s) < 16 or (p->>'secret') is distinct from s then
    raise exception 'Nije dozvoljeno.' using errcode = '42501';
  end if;

  with u as (
    update messages m set notified_at = now()
    where m.sender = 'family' and m.notified_at is null
    returning m.family_id, m.body, m.created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('family_id', f.id, 'family', f.name, 'is_test', f.is_test,
           'body', u.body, 'created_at', u.created_at) order by u.created_at), '[]'::jsonb)
    into msgs from u join families f on f.id = u.family_id;

  if kind = 'all' then
    with u as (
      update observations o set notified_at = now()
      where o.notified_at is null
      returning o.family_id, o.activity_title, o.experience, o.obs_date, o.details, o.remember, o.created_at
    )
    select coalesce(jsonb_agg(jsonb_build_object('family_id', f.id, 'family', f.name, 'is_test', f.is_test,
             'activity', u.activity_title, 'experience', u.experience, 'date', u.obs_date,
             'details', u.details, 'remember', u.remember) order by u.created_at), '[]'::jsonb)
      into obs from u join families f on f.id = u.family_id;

    with u as (
      update reviews r set notified_at = now()
      where r.notified_at is null
      returning r.family_id, r.week, r.good, r.hard, r.next_steps, r.created_at
    )
    select coalesce(jsonb_agg(jsonb_build_object('family_id', f.id, 'family', f.name, 'is_test', f.is_test,
             'week', u.week, 'good', u.good, 'hard', u.hard, 'next', u.next_steps) order by u.created_at), '[]'::jsonb)
      into revs from u join families f on f.id = u.family_id;
  end if;

  return jsonb_build_object('messages', msgs, 'observations', obs, 'reviews', revs);
end $$;

-- Ako slanje mejla ne uspe, Vercel funkcija vraća dešavanja kao neprijavljena.
create or replace function public.notify_undo(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare s text; since timestamptz := (p->>'since')::timestamptz;
begin
  select value into s from app_settings where key = 'notify_secret';
  if s is null or length(s) < 16 or (p->>'secret') is distinct from s then
    raise exception 'Nije dozvoljeno.' using errcode = '42501';
  end if;
  update messages set notified_at = null where notified_at >= since;
  update observations set notified_at = null where notified_at >= since;
  update reviews set notified_at = null where notified_at >= since;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.notify_collect(jsonb), public.notify_undo(jsonb) to anon, authenticated;

-- tajna za Vercel funkciju (ista kao NOTIFY_SECRET na Vercel-u)
insert into public.app_settings (key, value) values ('notify_secret', 'i01h29OZniJ8gBGWeB7gbQC4RJ2gyF0S') on conflict (key) do update set value = excluded.value;
