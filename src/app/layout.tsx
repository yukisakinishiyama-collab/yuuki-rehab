import type { Metadata } from "next";
import { Sora, IBM_Plex_Sans, IBM_Plex_Mono, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

// ディスプレイ見出し（欧文）
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// 本文・UI（欧文）
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

// 数値・臨床指標（等幅）
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

// 日本語（Zen Kaku Gothic New — 均整がとれた和文ゴシック、医療 UI の信頼感に適合）
const zenKakuGothicNew = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  variable: "--font-zen-kaku",
  weight: ["400", "500", "700"],
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
  icons: {
    icon: "/icon.png.png?v=20260521",
    apple: "/icon.png.png?v=20260521",
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
      className={`${sora.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} ${zenKakuGothicNew.variable}`}
    >
      <head>
        <link rel="icon" href="/icon.png.png?v=20260521" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png.png?v=20260521" />
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
