create table quotes (
  id           text primary key,
  created_at   timestamptz default now(),
  type         text not null,
  addr         text,
  lat          float,
  lng          float,
  flood_zone   text,
  year         int,
  material     text,
  area         int,
  floors       int,
  value        int,
  renovation   boolean default false,
  alarm        boolean default false,
  monitoring   boolean default false,
  doors        boolean default false,
  fire         boolean default false,
  coverages    text[],
  annual       int,
  status       text default 'new',
  client_name  text,
  client_email text,
  notes        text
);

alter table quotes enable row level security;
create policy "public read by id"    on quotes for select using (true);
create policy "public insert"        on quotes for insert with check (true);
create policy "public update status" on quotes for update using (true);
