import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'カラダの地図 | リハビリ卒業サポートアプリ',
  description: '患者様が自分の身体の回復過程を理解し、納得して卒業するためのサポートアプリです。',
};

export default function KaradaMapLayout({ children }: { children: React.ReactNode }) {
  return <div className="karada-map">{children}</div>;
}
