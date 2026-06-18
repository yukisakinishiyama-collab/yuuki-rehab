/**
 * LINE Messaging API Webhook
 *
 * 設定手順:
 * 1. LINE Developers Console でチャネルを作成
 * 2. Webhook URL に https://yourdomain.com/api/karada-line/webhook を設定
 * 3. 環境変数に以下を追加:
 *    LINE_CHANNEL_SECRET=xxxx
 *    LINE_CHANNEL_ACCESS_TOKEN=xxxx
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getSession, setSession, clearSession,
  addLineAppointment, parseDatetime, formatDatetimeJa,
} from '@/lib/karada-line-session';

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? '';
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '';

// LINE署名検証
function verifySignature(body: string, signature: string): boolean {
  if (!CHANNEL_SECRET) return true; // 開発環境では検証スキップ
  const hash = crypto
    .createHmac('SHA256', CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// LINEへ返信
async function replyMessage(replyToken: string, messages: { type: string; text: string }[]) {
  if (!ACCESS_TOKEN) {
    console.log('[LINE Bot] reply (dev mode):', messages.map(m => m.text).join(' / '));
    return;
  }
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

// テキストメッセージ処理
async function handleTextMessage(
  userId: string,
  displayName: string,
  text: string,
  replyToken: string,
) {
  const trimmed = text.trim();
  const session = getSession(userId);

  // どのステップでも「キャンセル」「やめる」でリセット
  if (/^(キャンセル|やめる|中止|もどる)$/.test(trimmed)) {
    clearSession(userId);
    await replyMessage(replyToken, [{
      type: 'text',
      text: '予約の操作を中止しました。またいつでもご連絡ください😊',
    }]);
    return;
  }

  switch (session.step) {
    case 'idle': {
      // 予約トリガーワード
      if (/予約|よやく|空き|あき/.test(trimmed)) {
        setSession(userId, { step: 'wait_name', lineDisplayName: displayName });
        await replyMessage(replyToken, [{
          type: 'text',
          text: `ご予約を承ります🗓️\nお名前をフルネームでお知らせください。\n例: 田中 花子`,
        }]);
      } else if (/確認|よやく確認|予約確認/.test(trimmed)) {
        await replyMessage(replyToken, [{
          type: 'text',
          text: '予約の確認は院までお電話いただくか、スタッフにLINEでご連絡ください。\nご予約を新たに入れる場合は「予約」とお送りください。',
        }]);
      } else {
        await replyMessage(replyToken, [{
          type: 'text',
          text: '「予約」とお送りいただくと、ご予約の手続きができます。\nお気軽にどうぞ😊',
        }]);
      }
      break;
    }

    case 'wait_name': {
      if (trimmed.length < 2) {
        await replyMessage(replyToken, [{
          type: 'text',
          text: 'お名前をもう一度お送りください（例: 田中 花子）',
        }]);
        return;
      }
      setSession(userId, { step: 'wait_datetime', patientName: trimmed });
      await replyMessage(replyToken, [{
        type: 'text',
        text: `${trimmed}様、ご希望の日時をお知らせください。\n\n例:\n・6月15日 10時\n・6/15 14:30\n\n診療時間: 月〜土 9:00〜18:00\n「キャンセル」で最初に戻ります`,
      }]);
      break;
    }

    case 'wait_datetime': {
      const iso = parseDatetime(trimmed);
      if (!iso) {
        await replyMessage(replyToken, [{
          type: 'text',
          text: '日時の形式が認識できませんでした。\n以下の形式でお試しください👇\n・6月15日 10時\n・6/15 14:00',
        }]);
        return;
      }
      const hour = parseInt(iso.split('T')[1].slice(0, 2));
      if (hour < 9 || hour >= 18) {
        await replyMessage(replyToken, [{
          type: 'text',
          text: `診療時間は9:00〜18:00です。\nお時間をご確認の上、もう一度お知らせください。`,
        }]);
        return;
      }
      setSession(userId, { step: 'wait_confirm', requestedDatetime: iso });
      const formatted = formatDatetimeJa(iso);
      await replyMessage(replyToken, [{
        type: 'text',
        text: `以下の内容でご予約を受け付けてよろしいでしょうか？\n\n👤 ${session.patientName}様\n🗓️ ${formatted}\n\n「確定」でご予約が完了します。\n変更は「キャンセル」でやり直せます。`,
      }]);
      break;
    }

    case 'wait_confirm': {
      if (/^(確定|はい|OK|ok|よろしく|お願い)/.test(trimmed)) {
        const appt = addLineAppointment({
          patientName: session.patientName ?? displayName,
          lineUserId: userId,
          lineDisplayName: displayName,
          datetime: session.requestedDatetime!,
          status: 'pending',
        });
        clearSession(userId);
        const formatted = formatDatetimeJa(appt.datetime);
        await replyMessage(replyToken, [{
          type: 'text',
          text: `ご予約を受け付けました！✅\n\n👤 ${appt.patientName}様\n🗓️ ${formatted}\n\n当日はお気をつけてお越しください。ご都合が変わった場合は、このLINEに一言ご連絡ください。お待ちしております😊`,
        }]);
      } else {
        await replyMessage(replyToken, [{
          type: 'text',
          text: '「確定」でご予約を確定します。\nやり直す場合は「キャンセル」とお送りください。',
        }]);
      }
      break;
    }
  }
}

// GETは Webhook URL 疎通確認用
export async function GET() {
  return NextResponse.json({ status: 'LINE Webhook is ready' });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-line-signature') ?? '';

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: { events: Record<string, unknown>[] };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // イベントを並列処理
  await Promise.all(
    payload.events.map(async (event) => {
      if (event.type !== 'message') return;
      const msg = event.message as Record<string, unknown>;
      if (msg.type !== 'text') return;

      const source = event.source as Record<string, unknown>;
      const userId = source.userId as string;
      const replyToken = event.replyToken as string;
      const text = msg.text as string;

      // displayName 取得（簡略化: Webhook では直接取れないのでLINE User ID を使う）
      // 本番: GET https://api.line.me/v2/bot/profile/{userId} で取得
      const displayName = userId.slice(0, 8);

      await handleTextMessage(userId, displayName, text, replyToken);
    })
  );

  return NextResponse.json({ status: 'ok' });
}
