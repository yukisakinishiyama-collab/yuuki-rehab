/**
 * Project ONE — 買い切り型AIライフアシスタント データ層
 *
 * 設計方針（プロジェクト指示書より）:
 * - バックエンドDBなし。全データは端末内（localStorage）に保存 → 通信量最小・オフライン動作
 * - サブスク・課金要素なし。サーバー依存は AI 回答の取得のみ
 * - オフライン時はローカルの回答ライブラリでフォールバックし、主要機能を維持する
 */

// ========================
// 型定義
// ========================

export interface Consultation {
  id: string;
  question: string;
  answer: string;
  /** AI が提案する「今日の行動」 */
  action: string;
  favorite: boolean;
  /** オフラインのローカル回答かどうか */
  offline: boolean;
  createdAt: string; // ISO 8601
}

interface OneStoreData {
  consultations: Consultation[];
}

const STORAGE_KEY = 'project-one-store-v1';
const MAX_HISTORY = 200;

// ========================
// localStorage 入出力 + 変更通知（useSyncExternalStore 用）
// ========================

let cache: OneStoreData | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** React の useSyncExternalStore 用 subscribe */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(): OneStoreData {
  if (typeof window === 'undefined') return { consultations: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { consultations: [] };
    const data = JSON.parse(raw) as OneStoreData;
    if (!Array.isArray(data.consultations)) return { consultations: [] };
    return data;
  } catch {
    return { consultations: [] };
  }
}

function save(data: OneStoreData) {
  cache = data;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 容量超過などは黙って無視（履歴は端末内キャッシュ扱い）
  }
  emit();
}

// ========================
// 公開 API
// ========================

const EMPTY: Consultation[] = [];

/** クライアント側スナップショット（参照が安定するようキャッシュを返す） */
export function getConsultations(): Consultation[] {
  if (typeof window === 'undefined') return EMPTY;
  if (!cache) cache = load();
  return cache.consultations;
}

/** SSR/プリレンダー用スナップショット（常に空） */
export function getServerConsultations(): Consultation[] {
  return EMPTY;
}

export function addConsultation(
  input: Pick<Consultation, 'question' | 'answer' | 'action' | 'offline'>
): Consultation {
  const data = load();
  const item: Consultation = {
    id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    favorite: false,
    createdAt: new Date().toISOString(),
    ...input,
  };
  data.consultations = [item, ...data.consultations].slice(0, MAX_HISTORY);
  save(data);
  return item;
}

export function toggleFavorite(id: string): Consultation[] {
  const data = load();
  data.consultations = data.consultations.map((c) =>
    c.id === id ? { ...c, favorite: !c.favorite } : c
  );
  save(data);
  return data.consultations;
}

export function removeConsultation(id: string): Consultation[] {
  const data = load();
  data.consultations = data.consultations.filter((c) => c.id !== id);
  save(data);
  return data.consultations;
}

// ========================
// 今日の行動（端末内で完結・オフライン動作）
// ========================

const DAILY_ACTIONS = [
  '朝起きたら、カーテンを開けて1分だけ日光を浴びる',
  '寝る前にスマホを置いて、3回深呼吸する',
  '今日の「よかったこと」をひとつだけメモする',
  'コップ1杯の水をゆっくり飲む',
  '5分だけ散歩する。近所を1周でOK',
  '机の上のいらない物を3つだけ片付ける',
  '大切な人に「ありがとう」をひとこと伝える',
  '肩を10回まわして、体の力を抜く',
  '今日やることを3つだけ書き出す',
  'あたたかい飲み物を飲みながら、何もしない時間を3分つくる',
  '階段を1回だけ使ってみる',
  '寝る時間を今日は15分だけ早くする',
  '「まあいいか」と声に出して言ってみる',
  '好きな音楽を1曲、目を閉じて聴く',
] as const;

/** 日付から決まる「今日の行動」。同じ日は同じ提案を返す。 */
export function getTodayAction(date = new Date()): string {
  const seed =
    date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate();
  return DAILY_ACTIONS[seed % DAILY_ACTIONS.length];
}

// ========================
// オフラインフォールバック回答
// ========================

interface FallbackRule {
  keywords: string[];
  answer: string;
  action: string;
}

const FALLBACK_RULES: FallbackRule[] = [
  {
    keywords: ['眠', '睡眠', '寝', '不眠'],
    answer:
      'よく眠れないのはつらいですね。まずは「寝る前30分はスマホを見ない」ことから試してみましょう。部屋を少し暗くして、深呼吸をすると体が休むモードに切り替わりやすくなります。',
    action: '今夜は寝る30分前にスマホを手の届かない場所に置く',
  },
  {
    keywords: ['仕事', '職場', '上司', '残業', '転職'],
    answer:
      '仕事の悩みはひとりで抱えると大きく見えがちです。悩みを紙に書き出すと、「今できること」と「今は考えなくていいこと」が分かれて、気持ちが軽くなります。',
    action: '仕事の悩みを紙に3行だけ書き出す',
  },
  {
    keywords: ['人間関係', '友達', '友人', '家族', '恋人', 'パートナー', 'けんか', '喧嘩'],
    answer:
      '人との関係で悩むのは、相手を大切に思っている証拠です。まずは自分の気持ちを整理してから、短い言葉で伝えてみましょう。全部わかり合えなくても大丈夫です。',
    action: '相手に伝えたいことを、ひとこと(20文字以内)にまとめてみる',
  },
  {
    keywords: ['疲れ', 'だるい', 'ストレス', 'しんどい', 'つらい', '不安'],
    answer:
      '疲れやモヤモヤを感じるときは、がんばりすぎのサインかもしれません。今日は「何もしない時間」を少しだけ作ってあげてください。休むことも大事な予定のひとつです。',
    action: '今日は10分だけ、何もしない休憩時間をとる',
  },
  {
    keywords: ['お金', '貯金', '節約', '家計'],
    answer:
      'お金の不安は、全体が見えないときに大きくなります。まずは今月使ったお金を大きく3つ(食費・固定費・その他)に分けて眺めるだけで、次の一歩が見えてきます。',
    action: '今月の支出を3つのグループに分けてメモする',
  },
  {
    keywords: ['運動', 'ダイエット', '健康', '体重', '食事'],
    answer:
      '健康づくりは「小さく始めて続ける」のがいちばんの近道です。いきなり頑張るより、今日5分だけ体を動かすことから始めましょう。続いたら少しずつ増やせばOKです。',
    action: '今日は5分だけ散歩する',
  },
];

const FALLBACK_DEFAULT: Omit<FallbackRule, 'keywords'> = {
  answer:
    'お話しいただきありがとうございます。いまはインターネットに接続できないため、かんたんなヒントをお伝えします。悩みを紙に書き出して眺めると、頭の中が整理されて次の一歩が見つけやすくなります。接続が戻ったら、もう一度相談してみてください。',
  action: '悩みを紙に3行だけ書き出してみる',
};

/** オフライン時・API失敗時のローカル回答。キーワード一致で選ぶ。 */
export function getOfflineAnswer(question: string): {
  answer: string;
  action: string;
} {
  for (const rule of FALLBACK_RULES) {
    if (rule.keywords.some((k) => question.includes(k))) {
      return { answer: rule.answer, action: rule.action };
    }
  }
  return { ...FALLBACK_DEFAULT };
}
