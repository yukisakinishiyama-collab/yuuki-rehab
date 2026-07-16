-- マーケティングハブ: LINE顧客ストア（本番用）
-- Supabaseの SQL Editor にそのまま貼り付けて実行する。
-- サービスロールキー（サーバー専用）でのみアクセスするため、RLSは有効化して全拒否のままにする。

create table if not exists marketing_line_contacts (
  user_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table marketing_line_contacts enable row level security;

-- 更新日時の自動更新
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_marketing_line_contacts_updated on marketing_line_contacts;
create trigger trg_marketing_line_contacts_updated
  before update on marketing_line_contacts
  for each row execute function set_updated_at();
