import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YUUKI REHAB | 運動器リハビリ動画分析",
  description: "理学療法士・医師・トレーナーのための運動器リハビリテーション動画分析プラットフォーム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
