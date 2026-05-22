import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ゆうき整骨院｜下関のスポーツ障害・術前術後リハビリ専門整骨院",
  description: "山口県下関市のゆうき整骨院。スポーツ障害・術前術後リハビリ・競技復帰に特化した運動療法型整骨院。",
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
    <html lang="ja">
      <head>
        <link rel="icon" href="/icon.png.png?v=20260521" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png.png?v=20260521" />
      </head>
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
