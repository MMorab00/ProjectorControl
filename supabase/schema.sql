create extension if not exists pgcrypto;
create type public.user_role as enum ('admin','socio_tecnico');
create type public.session_state as enum ('COMPLETATA','LASCIATO_ACCESO','IN_CARICO','SPENTO');
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,first_name text not null default 'Utente',last_name text,email text,role public.user_role not null default 'socio_tecnico',active boolean not null default true,created_at timestamptz not null default now());
create table public.projectors(id uuid primary key default gen_random_uuid(),name text not null,interval_days int not null default 7 check(interval_days between 1 and 365),active boolean not null default true,created_at timestamptz not null default now());
create table public.maintenance_sessions(id uuid primary key default gen_random_uuid(),projector_id uuid not null references public.projectors(id) on delete cascade,user_id uuid not null references public.profiles(id),powered_at timestamptz not null default now(),projector_on boolean not null default true,server_on boolean not null default false,lamp_on boolean not null default false,notes text,shutdown_at timestamptz,shutdown_user_id uuid references public.profiles(id),claimed_by uuid references public.profiles(id),claimed_at timestamptz,state public.session_state not null default 'COMPLETATA',created_at timestamptz not null default now());
insert into public.projectors(name,interval_days) select 'Proiettore Cinema',7 where not exists(select 1 from public.projectors);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,first_name,last_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'first_name','Utente'),new.raw_user_meta_data->>'last_name',new.email) on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active=true); $$;
alter table public.profiles enable row level security; alter table public.projectors enable row level security; alter table public.maintenance_sessions enable row level security;
create policy "profiles authenticated read" on public.profiles for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true));
create policy "profiles admin update" on public.profiles for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "projectors authenticated read" on public.projectors for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true));
create policy "projectors admin all" on public.projectors for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "sessions authenticated read" on public.maintenance_sessions for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true));
create policy "sessions authenticated insert" on public.maintenance_sessions for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true));
create policy "sessions authenticated update" on public.maintenance_sessions for update to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true)) with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true));
create policy "sessions admin delete" on public.maintenance_sessions for delete to authenticated using(public.is_admin());
alter publication supabase_realtime add table public.maintenance_sessions;


-- Data API grants required by Supabase client roles
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projectors to authenticated;
grant select, insert, update, delete on public.maintenance_sessions to authenticated;
