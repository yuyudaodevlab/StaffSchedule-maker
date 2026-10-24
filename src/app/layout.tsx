import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "運営向けスケジュールメーカー",
  description: "複雑なイベント運営を、可愛く、分かりやすく、簡単に。",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
