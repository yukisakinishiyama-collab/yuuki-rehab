-- ゆうき整骨院リハビリ管理システム - Supabase 初期セットアップ
-- Supabase の「SQL Editor」に貼り付けて実行してください

-- データ同期テーブル
CREATE TABLE IF NOT EXISTS clinic_sync (
  id    TEXT PRIMARY KEY DEFAULT 'main',
  data  JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期レコードを挿入
INSERT INTO clinic_sync (id, data)
VALUES ('main', '{}')
ON CONFLICT (id) DO NOTHING;

-- RLS（Row Level Security）を有効化
ALTER TABLE clinic_sync ENABLE ROW LEVEL SECURITY;

-- APIキー認証はアプリ側で行うため、DB レベルは全許可
CREATE POLICY "allow_all" ON clinic_sync
  FOR ALL USING (true) WITH CHECK (true);
