import type { CapacitorConfig } from '@capacitor/cli';

/**
 * ONE — iOS 展開用 Capacitor 設定テンプレート
 *
 * このファイルは iOS ラッパープロジェクト側（別リポジトリ推奨）に置く。
 * 本リポジトリには依存を追加しない（Web 側のビルドを汚さないため）。
 * 手順は docs/project-one/ios.md を参照。
 */
const config: CapacitorConfig = {
  appId: 'jp.projectone.one',
  appName: 'ONE',
  // リモートURL方式: Web 側の改善がそのままアプリに反映される
  server: {
    url: 'https://yuuki-rehab.vercel.app/one',
    allowNavigation: ['yuuki-rehab.vercel.app'],
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
  },
};

export default config;
