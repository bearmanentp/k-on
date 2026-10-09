"use client";

import Link from "next/link";
import { ArrowUpRight, BellRing, CalendarDays, MessageSquareText, Newspaper, Settings2 } from "lucide-react";

type SiteHubProps = {
  isAdmin?: boolean;
  unreadCount?: number;
  points?: number;
};

/** A single, predictable entry point for the site's main jobs. */
export function SiteHub({ isAdmin = false, unreadCount = 0, points = 0 }: SiteHubProps) {
  const cards = [
    { eyebrow: "COMMUNITY", title: "커뮤니티", description: "소식·공지·문의 게시판을 한곳에서 확인하세요.", href: "/boards#news", icon: Newspaper },
    { eyebrow: "EVENT", title: "행사·예약", description: "진행 중인 팬 행사와 신청폼을 살펴보세요.", href: "/events", icon: CalendarDays },
    { eyebrow: "MEMBER", title: "회원 공간", description: unreadCount ? `새 알림 ${unreadCount}개 · 보유 포인트 ${points.toLocaleString()}P` : `내 문의·예약과 ${points.toLocaleString()}P 포인트를 확인하세요.`, href: "/boards#inquiries", icon: unreadCount ? BellRing : MessageSquareText },
    ...(isAdmin ? [{ eyebrow: "CONTROL", title: "관리 시스템", description: "콘텐츠, 행사, 권한을 역할별로 관리하세요.", href: "/admin", icon: Settings2 }] : []),
  ];

  return (
    <section id="site-map" className="site-hub" aria-labelledby="site-hub-title">
      <div className="site-hub-heading">
        <div>
          <small>EXPLORE K-ON! FANDOM</small>
          <h2 id="site-hub-title">필요한 곳으로<br />바로 이동하세요</h2>
        </div>
        <p>홈에서는 새로운 소식과 다음 행사를 빠르게 보고, 상세한 내용은 각 전용 공간에서 이어서 확인할 수 있습니다.</p>
      </div>
      <div className="site-hub-grid">
        {cards.map(({ eyebrow, title, description, href, icon: Icon }) => (
          <Link className="site-hub-card" href={href} key={title}>
            <span className="site-hub-icon"><Icon /></span>
            <span className="site-hub-copy"><small>{eyebrow}</small><b>{title}</b><span>{description}</span></span>
            <ArrowUpRight className="site-hub-arrow" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
