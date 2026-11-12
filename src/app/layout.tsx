import type { Metadata } from "next";
import localFont from "next/font/local";
// 日本語（Zen Kaku Gothic New — 均整がとれた和文ゴシック、医療 UI の信頼感に適合）
// 文字の範囲ごとに分かれたファイルで、使う文字の分だけ読み込まれる。変数 --font-zen-kaku は globals.css で定義
import "@fontsource/zen-kaku-gothic-new/400.css";
import "@fontsource/zen-kaku-gothic-new/500.css";
import "@fontsource/zen-kaku-gothic-new/700.css";
import "./globals.css";

// フォントはビルド時に Google Fonts から取らず、リポジトリ内のファイルを使う（src/app/fonts/README.md）

// ディスプレイ見出し（欧文）
const sora = localFont({
  src: [
    { path: "./fonts/sora-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/sora-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/sora-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/sora-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/sora-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-sora",
  display: "swap",
});

// 本文・UI（欧文）
const ibmPlexSans = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

// 数値・臨床指標（等幅）
const ibmPlexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ゆうき整骨院｜下関のスポーツ障害・術前術後リハビリ専門整骨院",
  description: "山口県下関市のゆうき整骨院。スポーツ障害・術前術後リハビリ・競技復帰に特化した運動療法型整骨院。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "YUUKI REHAB",
  },
  // アイコンは小さく縮めたもの（元の icon.png.png は 1.3MB あり、どの画面でも読み込まれて遅くしていた）
  icons: {
    icon: [
      { url: "/favicon-48.png?v=20261024", sizes: "48x48", type: "image/png" },
      { url: "/app-icon-192.png?v=20261024", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/apple-icon-180.png?v=20261024", sizes: "180x180" },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={`${sora.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <meta name="theme-color" content="#0d9488" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="YUUKI REHAB" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="min-h-screen bg-[--color-surface] font-body antialiased">
        {children}
      </body>
    </html>
  );
}
