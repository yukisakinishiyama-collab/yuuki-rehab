-- マーケティングハブ: 動画ストック管理
-- Supabaseの SQL Editor にそのまま貼り付けて実行する。
-- サービスロールキー（サーバー専用）でのみアクセスするため、RLSは有効化。
-- ※患者が写る動画は permission='none'（掲載許可なし）だと公開工程に進めない運用。

create table if not exists marketing_videos (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table marketing_videos enable row level security;

-- 更新日時の自動更新（set_updated_at は line_contacts のマイグレーションで作成済み。
-- 未作成の環境向けに冪等に定義）
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_marketing_videos_updated on marketing_videos;
create trigger trg_marketing_videos_updated
  before update on marketing_videos
  for each row execute function set_updated_at();
