"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Home, Info, Music2, Newspaper, Sparkles, Users } from "lucide-react";
import { BOARD_DEFINITIONS, type BoardDefinition } from "@/lib/board-config";

type ActivePage="home"|"events"|"boards"|"shop"|"mypage";

export function PublicHeader({siteName,logoUrl,active,boards=BOARD_DEFINITIONS,actions}:{siteName:string;logoUrl:string;active?:ActivePage;boards?:BoardDefinition[];actions?:ReactNode}){
  return <header className="site-header public-header">
    <Link href="/" className="brand"><Image src={logoUrl} alt="K-ON!" width={124} height={44} unoptimized/><span>{siteName}</span></Link>
    <nav className="desktop-nav" aria-label="주 메뉴">
      <Link href="/" className={active==="home"?"active":""}>홈</Link>
      <Link href="/#about">소개</Link>
      <Link href="/#site-map">둘러보기</Link>
      <Link href="/#characters">캐릭터</Link>
      <Link href="/events" className={active==="events"?"active":""}>행사·예약</Link>
      <Link href="/shop" className={active==="shop"?"active":""}>상점</Link>
      <details className={`nav-dropdown ${active==="boards"?"active":""}`}><summary>커뮤니티</summary><div>{boards.map(({key,menuLabel,icon:Icon})=><Link href={`/boards#${key}`} key={key}><Icon/>{menuLabel}</Link>)}</div></details>
    </nav>
    <details className="mobile-nav"><summary aria-label="전체 메뉴 열기"><span className="toggler-icon" aria-hidden="true"><i/><i/><i/></span><span className="sr-menu-label">메뉴</span></summary><div>
      <Link href="/"><Home/>홈</Link><Link href="/#about"><Info/>소개</Link><Link href="/#site-map"><Sparkles/>둘러보기</Link><Link href="/#characters"><Users/>캐릭터</Link><Link href="/events"><CalendarDays/>행사·예약</Link><Link href="/shop"><Music2/>상점</Link>
      <details className="mobile-community"><summary><Newspaper/>커뮤니티</summary><div>{boards.map(({key,menuLabel,icon:Icon})=><Link href={`/boards#${key}`} key={key}><Icon/>{menuLabel}</Link>)}</div></details>
    </div></details>
    {actions&&<div className="header-actions">{actions}</div>}
  </header>;
}
