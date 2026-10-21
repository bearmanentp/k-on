"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { CalendarDays, Film, Home, Info, Music2, Newspaper, Sparkles, Users } from "lucide-react";
import { BOARD_DEFINITIONS, type BoardDefinition } from "@/lib/board-config";
import { AccountMenu } from "./account-menu";
import { db } from "@/lib/firebase";
import { mergeBuiltInFeaturePages, MOVIE_FEATURE_SLUG } from "@/lib/feature-page-defaults";

type ActivePage="home"|"events"|"boards"|"shop"|"mypage"|"special";
type FeatureMenuPage={id:string;slug:string;menuLabel:string;active?:boolean;showInMenu?:boolean;publishAt?:string;hideAt?:string;order?:number};

export function PublicHeader({siteName,logoUrl,active,boards=BOARD_DEFINITIONS,actions}:{siteName:string;logoUrl:string;active?:ActivePage;boards?:BoardDefinition[];actions?:ReactNode}){
  const [featurePages,setFeaturePages]=useState<FeatureMenuPage[]>(()=>mergeBuiltInFeaturePages([]) as FeatureMenuPage[]),[now,setNow]=useState(()=>Date.now());
  useEffect(()=>{if(!db)return;return onSnapshot(query(collection(db,"featurePages"),orderBy("order","asc")),snapshot=>setFeaturePages(mergeBuiltInFeaturePages(snapshot.docs.map(item=>({id:item.id,...item.data()}) as FeatureMenuPage)) as FeatureMenuPage[]),()=>{});},[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30_000);return()=>clearInterval(timer);},[]);
  const menuPages=useMemo(()=>featurePages.filter(page=>page.active!==false&&page.showInMenu!==false&&(!page.publishAt||new Date(page.publishAt).getTime()<=now)&&(!page.hideAt||new Date(page.hideAt).getTime()>now)),[featurePages,now]);
  return <header className="site-header public-header">
    <Link href="/" className="brand"><Image src={logoUrl} alt="K-ON!" width={124} height={44} unoptimized/><span>{siteName}</span></Link>
    <nav className="desktop-nav" aria-label="주 메뉴">
      <Link href="/" className={active==="home"?"active":""}>홈</Link>
      <Link href="/#about">소개</Link>
      <Link href="/#site-map">둘러보기</Link>
      <Link href="/#characters">캐릭터</Link>
      <Link href="/events" className={active==="events"?"active":""}>행사·예약</Link>
      {menuPages.map(page=><Link href={`/special?slug=${encodeURIComponent(page.slug)}`} className={active==="special"?"active":""} key={page.id}>{page.menuLabel}</Link>)}
      <Link href="/shop" className={active==="shop"?"active":""}>상점</Link>
      <details className={`nav-dropdown ${active==="boards"?"active":""}`}><summary>커뮤니티</summary><div>{boards.map(({key,menuLabel,icon:Icon})=><Link href={`/boards#${key}`} key={key}><Icon/>{menuLabel}</Link>)}</div></details>
    </nav>
    <details className="mobile-nav"><summary aria-label="전체 메뉴 열기"><span className="toggler-icon" aria-hidden="true"><i/><i/><i/></span><span className="sr-menu-label">메뉴</span></summary><div>
      <Link href="/"><Home/>홈</Link><Link href="/#about"><Info/>소개</Link><Link href="/#site-map"><Sparkles/>둘러보기</Link><Link href="/#characters"><Users/>캐릭터</Link><Link href="/events"><CalendarDays/>행사·예약</Link>{menuPages.map(page=>{const Icon=page.slug===MOVIE_FEATURE_SLUG?Film:Sparkles;return <Link href={`/special?slug=${encodeURIComponent(page.slug)}`} key={page.id}><Icon/>{page.menuLabel}</Link>})}<Link href="/shop"><Music2/>상점</Link>
      <details className="mobile-community"><summary><Newspaper/>커뮤니티</summary><div>{boards.map(({key,menuLabel,icon:Icon})=><Link href={`/boards#${key}`} key={key}><Icon/>{menuLabel}</Link>)}</div></details>
    </div></details>
    <div className="header-actions">{actions===undefined?<AccountMenu/>:actions}</div>
  </header>;
}
