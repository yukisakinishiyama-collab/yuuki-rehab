/**
 * gpt-image-2 呼び出しクライアント
 *
 * - OPENAI_API_KEY は環境変数または .env / .env.local から読む（コードに直書きしない）
 * - 429/5xx のみ最大3回まで指数バックオフで再試行する
 * - モデレーションエラー（400系のコンテンツポリシー違反）は再試行しない
 * - エラーログにAPIキーや患者情報を含めない
 */

import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

// .env / .env.local からキーを読む（BOM対応。値はログに出さない）
export function loadOpenAiKey(repoRoot: string): string | null {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  for (const name of ['.env.local', '.env']) {
    const p = path.join(repoRoot, name);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8').replace(/^﻿/, '');
      const m = content.match(/^OPENAI_API_KEY=(.+)$/m);
      if (m) return m[1].trim();
    }
  }
  return null;
}

const MAX_RETRIES = 3;

function isRetryable(status: number | undefined): boolean {
  return status === 429 || (status !== undefined && status >= 500);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 画像を生成してPNGのBufferを返す。
 * quality: 通常は 'medium'、細かい図解や文字を含む場合のみ 'high'
 */
export async function generateImage(opts: {
  apiKey: string;
  prompt: string;
  size: string; // 例 '1088x1360'
  quality: 'medium' | 'high';
}): Promise<Buffer> {
  const client = new OpenAI({ apiKey: opts.apiKey });

  let attempt = 0;
  // 初回 + 再試行3回まで。再試行は429/5xxのみ。
  for (;;) {
    try {
      const result = await client.images.generate({
        model: 'gpt-image-2',
        prompt: opts.prompt,
        size: opts.size as never, // モデル固有サイズはSDKの型より新しい場合がある
        quality: opts.quality,
        n: 1,
      });
      const b64 = result.data?.[0]?.b64_json;
      if (!b64) throw new Error('画像データが返されませんでした');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      const status = (err as { status?: number }).status;
      const code = (err as { code?: string }).code ?? '';
      // モデレーション（コンテンツポリシー）エラーは再試行しない
      if (code === 'moderation_blocked' || code === 'content_policy_violation') {
        throw new Error('モデレーションにより生成が拒否されました。ImageSpecの内容を見直してください（自動再試行はしません）');
      }
      if (isRetryable(status) && attempt < MAX_RETRIES) {
        attempt++;
        const waitMs = 1000 * 2 ** attempt; // 2s, 4s, 8s
        console.warn(`一時的なエラー(HTTP ${status})。${waitMs / 1000}秒後に再試行します (${attempt}/${MAX_RETRIES})`);
        await sleep(waitMs);
        continue;
      }
      // キーや患者情報を含めない安全なメッセージだけを投げ直す
      throw new Error(`画像生成に失敗しました (HTTP ${status ?? '不明'})`);
    }
  }
}
