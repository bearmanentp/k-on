import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "K-ON! FANDOM KR",
  description: "K-ON! 팬들을 위한 행사, 공지, 신청 커뮤니티",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
