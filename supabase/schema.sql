-- =====================================================================
--  KUĆNI DEFEKTOLOG – baza podataka (Supabase / PostgreSQL)
--
--  Kako se koristi: Supabase → SQL Editor → New query → nalepite ceo
--  ovaj fajl → Run. Skripta sme da se pokrene više puta (ne briše podatke).
--
--  Bezbednost:
--   • Nijedna tabela nije direktno dostupna spolja (RLS uključen, bez polisa).
--   • Porodica pristupa SAMO svojim podacima preko funkcija family_*,
--     uz svoj tajni kod.
--   • Defektolog (prijavljen nalog) pristupa SAMO svojim porodicama
--     preko funkcija admin_*.
-- =====================================================================

-- ---------------------------------------------------------------- TABELE

create table if not exists public.families (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid(),
  name          text not null,
  children      text not null default '',
  access_code   text not null unique,
  is_test       boolean not null default false,
  archived      boolean not null default false,
  notes         text not null default '',
  consent_at    timestamptz,
  last_seen_at  timestamptz,
  owner_seen_at timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table if not exists public.programs (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  title        text not null default '',
  status       text not null default 'draft' check (status in ('draft','active','archived')),
  start_date   date,
  content      jsonb not null default '{}'::jsonb,
  source_name  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.images (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  mime        text not null default 'image/jpeg',
  data        text not null,
  width       int,
  height      int,
  created_at  timestamptz not null default now()
);

create table if not exists public.observations (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  program_id     uuid references public.programs(id) on delete set null,
  activity_code  text not null default '',
  activity_title text not null default '',
  obs_date       date not null default current_date,
  obs_time       text not null default '',
  tried          text not null default 'da',
  experience     text not null default '',
  alert_before   text not null default '',
  alert_after    text not null default '',
  details        text not null default '',
  remember       text not null default '',
  created_at     timestamptz not null default now()
);

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  program_id  uuid references public.programs(id) on delete set null,
  week        int not null default 1,
  review_date date not null default current_date,
  good        text not null default '',
  hard        text not null default '',
  next_steps  text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.tried (
  family_id     uuid not null references public.families(id) on delete cascade,
  program_id    uuid not null references public.programs(id) on delete cascade,
  activity_code text not null,
  created_at    timestamptz not null default now(),
  primary key (family_id, program_id, activity_code)
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  sender     text not null check (sender in ('family','owner')),
  body       text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index if not exists programs_family_idx     on public.programs(family_id);
create index if not exists images_program_idx      on public.images(program_id);
create index if not exists observations_family_idx on public.observations(family_id, created_at desc);
create index if not exists reviews_family_idx      on public.reviews(family_id);
create index if not exists messages_family_idx     on public.messages(family_id, created_at);

-- Niko ne pristupa tabelama direktno – samo kroz funkcije ispod.
alter table public.families     enable row level security;
alter table public.programs     enable row level security;
alter table public.images       enable row level security;
alter table public.observations enable row level security;
alter table public.reviews      enable row level security;
alter table public.tried        enable row level security;
alter table public.messages     enable row level security;
revoke all on public.families, public.programs, public.images, public.observations,
              public.reviews, public.tried, public.messages from anon, authenticated;

-- ---------------------------------------------------------------- POMOĆNE

-- Kod porodice: 8 znakova bez slova/brojeva koji se mešaju (0/O, 1/I/L).
create or replace function public._new_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  raw bytea;
  code text;
begin
  loop
    raw := decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex');
    code := '';
    for i in 0..7 loop
      code := code || substr(alphabet, (get_byte(raw, i) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from families where access_code = code);
  end loop;
  return code;
end $$;

create or replace function public._norm_code(c text) returns text
language sql immutable as $$ select upper(regexp_replace(coalesce(c, ''), '[^A-Za-z0-9]', '', 'g')) $$;

create or replace function public._family(p jsonb) returns public.families
language plpgsql stable security definer set search_path = public as $$
declare f families;
begin
  select * into f from families where access_code = _norm_code(p->>'code') and not archived;
  if not found then raise exception 'pogresan_kod' using errcode = 'P0002'; end if;
  return f;
end $$;

create or replace function public._owned(fid uuid) returns public.families
language plpgsql stable security definer set search_path = public as $$
declare f families;
begin
  if auth.uid() is null then raise exception 'niste_prijavljeni' using errcode = '42501'; end if;
  select * into f from families where id = fid and owner_id = auth.uid();
  if not found then raise exception 'nije_dozvoljeno' using errcode = '42501'; end if;
  return f;
end $$;

create or replace function public._active_program(fid uuid) returns public.programs
language sql stable security definer set search_path = public as $$
  select * from programs where family_id = fid and status = 'active'
  order by published_at desc nulls last limit 1
$$;

create or replace function public._family_data(fid uuid, include_all_programs boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  f families;
  prog programs;
  result jsonb;
begin
  select * into f from families where id = fid;
  prog := _active_program(fid);
  result := jsonb_build_object(
    'family', jsonb_build_object(
      'id', f.id, 'name', f.name, 'children', f.children, 'consent_at', f.consent_at,
      'code', f.access_code, 'is_test', f.is_test, 'archived', f.archived,
      'notes', case when include_all_programs then f.notes else null end,
      'last_seen_at', f.last_seen_at, 'created_at', f.created_at),
    'program', case when prog.id is null then null else jsonb_build_object(
      'id', prog.id, 'title', prog.title, 'start_date', prog.start_date,
      'published_at', prog.published_at, 'content', prog.content) end,
    'history', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'status', status, 'start_date', start_date,
        'published_at', published_at, 'created_at', created_at, 'source_name', source_name,
        'content', case when include_all_programs and status <> 'archived' then content else null end)
        order by created_at desc)
      from programs where family_id = fid and (include_all_programs or status = 'archived')), '[]'::jsonb),
    'tried', coalesce((select jsonb_agg(activity_code) from tried
      where family_id = fid and program_id = prog.id), '[]'::jsonb),
    'observations', coalesce((select jsonb_agg(to_jsonb(o) - 'family_id' order by o.created_at)
      from (select * from observations where family_id = fid order by created_at desc limit 1000) o), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(to_jsonb(r) - 'family_id' order by r.created_at)
      from reviews r where family_id = fid), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) - 'family_id' order by m.created_at)
      from messages m where family_id = fid), '[]'::jsonb)
  );
  return result;
end $$;

-- ---------------------------------------------------------------- PORODICA (kod)

create or replace function public.family_get(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare f families;
begin
  f := _family(p);
  update families set last_seen_at = now() where id = f.id;
  return _family_data(f.id, false);
end $$;

create or replace function public.family_consent(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare f families;
begin
  f := _family(p);
  update families set consent_at = coalesce(consent_at, now()) where id = f.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.family_add_observation(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  f families;
  prog programs;
  o jsonb := coalesce(p->'observation', '{}'::jsonb);
  rec observations;
begin
  f := _family(p);
  prog := _active_program(f.id);
  insert into observations (family_id, program_id, activity_code, activity_title, obs_date, obs_time,
                            tried, experience, alert_before, alert_after, details, remember)
  values (f.id, prog.id,
          left(coalesce(o->>'activity_code', ''), 40), left(coalesce(o->>'activity_title', ''), 300),
          coalesce(nullif(o->>'obs_date', '')::date, current_date), left(coalesce(o->>'obs_time', ''), 10),
          left(coalesce(nullif(o->>'tried', ''), 'da'), 20), left(coalesce(o->>'experience', ''), 40),
          left(coalesce(o->>'alert_before', ''), 80), left(coalesce(o->>'alert_after', ''), 80),
          left(coalesce(o->>'details', ''), 4000), left(coalesce(o->>'remember', ''), 4000))
  returning * into rec;
  if prog.id is not null and rec.activity_code <> '' and rec.tried <> 'ne' then
    insert into tried (family_id, program_id, activity_code) values (f.id, prog.id, rec.activity_code)
    on conflict do nothing;
  end if;
  return to_jsonb(rec) - 'family_id';
end $$;

create or replace function public.family_delete_observation(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare f families;
begin
  f := _family(p);
  delete from observations where id = (p->>'id')::uuid and family_id = f.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.family_set_tried(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  f families;
  prog programs;
begin
  f := _family(p);
  prog := _active_program(f.id);
  if prog.id is null then return jsonb_build_object('ok', false); end if;
  if coalesce((p->>'value')::boolean, true) then
    insert into tried (family_id, program_id, activity_code)
    values (f.id, prog.id, left(p->>'activity_code', 40)) on conflict do nothing;
  else
    delete from tried where family_id = f.id and program_id = prog.id and activity_code = p->>'activity_code';
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.family_add_review(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  f families;
  r jsonb := coalesce(p->'review', '{}'::jsonb);
  rec reviews;
begin
  f := _family(p);
  insert into reviews (family_id, program_id, week, review_date, good, hard, next_steps)
  values (f.id, (_active_program(f.id)).id, coalesce(nullif(r->>'week', '')::int, 1),
          coalesce(nullif(r->>'review_date', '')::date, current_date),
          left(coalesce(r->>'good', ''), 4000), left(coalesce(r->>'hard', ''), 4000),
          left(coalesce(r->>'next_steps', ''), 4000))
  returning * into rec;
  return to_jsonb(rec) - 'family_id';
end $$;

create or replace function public.family_delete_review(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare f families;
begin
  f := _family(p);
  delete from reviews where id = (p->>'id')::uuid and family_id = f.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.family_send_message(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  f families;
  rec messages;
begin
  f := _family(p);
  if coalesce(trim(p->>'body'), '') = '' then raise exception 'prazna_poruka'; end if;
  insert into messages (family_id, sender, body) values (f.id, 'family', left(p->>'body', 5000))
  returning * into rec;
  update messages set read_at = now() where family_id = f.id and sender = 'owner' and read_at is null;
  return to_jsonb(rec) - 'family_id';
end $$;

create or replace function public.family_read_messages(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare f families;
begin
  f := _family(p);
  update messages set read_at = now() where family_id = f.id and sender = 'owner' and read_at is null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.family_get_images(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f families;
begin
  f := _family(p);
  return coalesce((
    select jsonb_object_agg(i.id, i.data)
    from images i join programs pr on pr.id = i.program_id
    where pr.family_id = f.id and pr.status in ('active', 'archived')
      and i.id::text in (select jsonb_array_elements_text(coalesce(p->'ids', '[]'::jsonb)))
  ), '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------- DEFEKTOLOG (prijava)

create or replace function public.admin_overview(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'niste_prijavljeni' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(row_data order by (row_data->>'archived')::boolean, row_data->>'name')
    from (
      select jsonb_build_object(
        'id', f.id, 'name', f.name, 'children', f.children, 'code', f.access_code,
        'is_test', f.is_test, 'archived', f.archived, 'created_at', f.created_at,
        'last_seen_at', f.last_seen_at, 'consent_at', f.consent_at,
        'program', (select jsonb_build_object('id', pr.id, 'title', pr.title, 'start_date', pr.start_date,
                      'weeks', coalesce(nullif(pr.content->>'durationWeeks', '')::int, 4),
                      'activities', jsonb_array_length(coalesce(pr.content->'activities', '[]'::jsonb)))
                    from programs pr where pr.family_id = f.id and pr.status = 'active'
                    order by pr.published_at desc nulls last limit 1),
        'drafts', (select count(*) from programs pr where pr.family_id = f.id and pr.status = 'draft'),
        'obs_total', (select count(*) from observations o where o.family_id = f.id),
        'obs_7d', (select count(*) from observations o where o.family_id = f.id and o.created_at > now() - interval '7 days'),
        'last_obs_at', (select max(created_at) from observations o where o.family_id = f.id),
        'new_obs', (select count(*) from observations o where o.family_id = f.id and o.created_at > f.owner_seen_at),
        'unread', (select count(*) from messages m where m.family_id = f.id and m.sender = 'family' and m.read_at is null),
        'tried', (select count(*) from tried t join programs pr on pr.id = t.program_id
                  where t.family_id = f.id and pr.status = 'active')
      ) as row_data
      from families f where f.owner_id = auth.uid()
    ) s
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_family(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare f families;
begin
  f := _owned((p->>'id')::uuid);
  if coalesce((p->>'mark_seen')::boolean, true) then
    update families set owner_seen_at = now() where id = f.id;
    update messages set read_at = now() where family_id = f.id and sender = 'family' and read_at is null;
  end if;
  return _family_data(f.id, true) || jsonb_build_object('owner_seen_at', f.owner_seen_at);
end $$;

create or replace function public.admin_save_family(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare f families;
begin
  if auth.uid() is null then raise exception 'niste_prijavljeni' using errcode = '42501'; end if;
  if nullif(p->>'id', '') is null then
    insert into families (owner_id, name, children, is_test, notes, access_code)
    values (auth.uid(), coalesce(nullif(trim(p->>'name'), ''), 'Nova porodica'), coalesce(p->>'children', ''),
            coalesce((p->>'is_test')::boolean, false), coalesce(p->>'notes', ''), _new_code())
    returning * into f;
  else
    f := _owned((p->>'id')::uuid);
    update families set
      name     = coalesce(nullif(trim(p->>'name'), ''), name),
      children = coalesce(p->>'children', children),
      is_test  = coalesce((p->>'is_test')::boolean, is_test),
      archived = coalesce((p->>'archived')::boolean, archived),
      notes    = coalesce(p->>'notes', notes)
    where id = f.id returning * into f;
  end if;
  return to_jsonb(f) - 'owner_id';
end $$;

create or replace function public.admin_regenerate_code(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare f families;
begin
  f := _owned((p->>'id')::uuid);
  update families set access_code = _new_code() where id = f.id returning * into f;
  return jsonb_build_object('code', f.access_code);
end $$;

create or replace function public.admin_delete_family(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare f families;
begin
  f := _owned((p->>'id')::uuid);
  delete from families where id = f.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_delete_test_families(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'niste_prijavljeni' using errcode = '42501'; end if;
  with d as (delete from families where owner_id = auth.uid() and is_test returning 1)
  select count(*) into n from d;
  return jsonb_build_object('deleted', n);
end $$;

create or replace function public.admin_save_program(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  f families;
  prog programs;
begin
  if nullif(p->>'id', '') is null then
    f := _owned((p->>'family_id')::uuid);
    insert into programs (family_id, title, content, source_name, start_date)
    values (f.id, coalesce(p->>'title', ''), coalesce(p->'content', '{}'::jsonb),
            coalesce(p->>'source_name', ''), nullif(p->>'start_date', '')::date)
    returning * into prog;
  else
    select * into prog from programs where id = (p->>'id')::uuid;
    if not found then raise exception 'nema_programa'; end if;
    f := _owned(prog.family_id);
    update programs set
      title      = coalesce(p->>'title', title),
      content    = coalesce(p->'content', content),
      start_date = case when p ? 'start_date' then nullif(p->>'start_date', '')::date else start_date end,
      updated_at = now()
    where id = prog.id returning * into prog;
  end if;
  return jsonb_build_object('id', prog.id, 'status', prog.status);
end $$;

create or replace function public.admin_publish_program(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare prog programs;
begin
  select * into prog from programs where id = (p->>'id')::uuid;
  if not found then raise exception 'nema_programa'; end if;
  perform _owned(prog.family_id);
  update programs set status = 'archived' where family_id = prog.family_id and status = 'active' and id <> prog.id;
  update programs set status = 'active', published_at = now(),
         start_date = coalesce(nullif(p->>'start_date', '')::date, start_date, current_date)
  where id = prog.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_set_program_status(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare prog programs;
begin
  select * into prog from programs where id = (p->>'id')::uuid;
  if not found then raise exception 'nema_programa'; end if;
  perform _owned(prog.family_id);
  if p->>'status' not in ('draft', 'archived') then raise exception 'los_status'; end if;
  update programs set status = p->>'status' where id = prog.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_delete_program(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare prog programs;
begin
  select * into prog from programs where id = (p->>'id')::uuid;
  if not found then return jsonb_build_object('ok', true); end if;
  perform _owned(prog.family_id);
  delete from programs where id = prog.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_add_image(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  prog programs;
  new_id uuid;
begin
  select * into prog from programs where id = (p->>'program_id')::uuid;
  if not found then raise exception 'nema_programa'; end if;
  perform _owned(prog.family_id);
  if length(p->>'data') > 3000000 then raise exception 'slika_prevelika'; end if;
  insert into images (program_id, mime, data, width, height)
  values (prog.id, coalesce(p->>'mime', 'image/jpeg'), p->>'data',
          nullif(p->>'width', '')::int, nullif(p->>'height', '')::int)
  returning id into new_id;
  return jsonb_build_object('id', new_id);
end $$;

create or replace function public.admin_get_images(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'niste_prijavljeni' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_object_agg(i.id, i.data)
    from images i join programs pr on pr.id = i.program_id join families f on f.id = pr.family_id
    where f.owner_id = auth.uid()
      and i.id::text in (select jsonb_array_elements_text(coalesce(p->'ids', '[]'::jsonb)))
  ), '{}'::jsonb);
end $$;

create or replace function public.admin_reply(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  f families;
  rec messages;
begin
  f := _owned((p->>'family_id')::uuid);
  if coalesce(trim(p->>'body'), '') = '' then raise exception 'prazna_poruka'; end if;
  insert into messages (family_id, sender, body) values (f.id, 'owner', left(p->>'body', 5000))
  returning * into rec;
  update messages set read_at = now() where family_id = f.id and sender = 'family' and read_at is null;
  return to_jsonb(rec) - 'family_id';
end $$;

-- ---------------------------------------------------------------- PRAVA

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.family_get(jsonb), public.family_consent(jsonb), public.family_add_observation(jsonb),
  public.family_delete_observation(jsonb), public.family_set_tried(jsonb), public.family_add_review(jsonb),
  public.family_delete_review(jsonb), public.family_send_message(jsonb), public.family_read_messages(jsonb),
  public.family_get_images(jsonb)
to anon, authenticated;

grant execute on function
  public.admin_overview(jsonb), public.admin_family(jsonb), public.admin_save_family(jsonb),
  public.admin_regenerate_code(jsonb), public.admin_delete_family(jsonb), public.admin_delete_test_families(jsonb),
  public.admin_save_program(jsonb), public.admin_publish_program(jsonb), public.admin_set_program_status(jsonb),
  public.admin_delete_program(jsonb), public.admin_add_image(jsonb), public.admin_get_images(jsonb),
  public.admin_reply(jsonb)
to authenticated;
