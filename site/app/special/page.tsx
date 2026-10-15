"use client";

import { CSSProperties, useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import TiptapImage from "@tiptap/extension-image";
import { ArrowRight, CalendarDays } from "lucide-react";
import { db } from "@/lib/firebase";
import { PublicHeader } from "@/app/components/public-header";
import { DEFAULT_K_ON_LOGO } from "@/lib/site-defaults";
import { MovieAlertPanel } from "@/app/components/movie-alert-panel";

type FeaturePage={id:string;slug:string;title:string;menuLabel?:string;summary?:string;body?:string;bodyRich?:unknown;coverImageUrl?:string;videoUrl?:string;eventId?:string;publishAt?:string;hideAt?:string;active?:boolean};
function youtubeEmbed(url:string){const match=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&/]+)/);return match?`https://www.youtube.com/embed/${match[1]}`:"";}
const MOVIE_SLUG="k-on-movie-2026";
const MOVIE_PAGE:FeaturePage={id:MOVIE_SLUG,slug:MOVIE_SLUG,title:"다시 극장에서 만나는 케이온",menuLabel:"케이온 영화",summary:"2026년 10월 14일 롯데시네마 단독 재재재개봉. 예매 회차와 특전 소식을 한곳에서 확인하고 알림을 받아보세요.",body:"롯데시네마 상영시간표를 주기적으로 확인해 새 회차가 열리면 알려드립니다. 현재 상영관과 남은 좌석은 아래 실시간 감지 영역에서 확인하세요.",coverImageUrl:"https://cf.lottecinema.co.kr//Media/MovieFile/MovieImg/202503/22284_503_1.jpg",active:true};
export default function SpecialPage(){
  const [page,setPage]=useState<FeaturePage|null>(null),[slug,setSlug]=useState(""),[ready,setReady]=useState(false),[now,setNow]=useState(()=>Date.now()),[site,setSite]=useState({siteName:"K-ON! FANDOM KR",logoUrl:DEFAULT_K_ON_LOGO,fontFamily:'"Pretendard", "Noto Sans KR", system-ui, sans-serif'});
  useEffect(()=>{const requestedSlug=new URLSearchParams(window.location.search).get("slug")||"",fallback=requestedSlug===MOVIE_SLUG?MOVIE_PAGE:null;setSlug(requestedSlug);setPage(fallback);setReady(Boolean(fallback));if(!db){setReady(true);return;}const stopPage=onSnapshot(query(collection(db,"featurePages"),where("slug","==",requestedSlug)),snapshot=>{const item=snapshot.docs[0];setPage(item?({id:item.id,...item.data()} as FeaturePage):fallback);setReady(true);},()=>{setPage(fallback);setReady(true);});const stopSite=onSnapshot(collection(db,"siteSettings"),snapshot=>{const item=snapshot.docs.find(doc=>doc.id==="main");if(item)setSite(current=>({...current,...item.data()}));},()=>{});return()=>{stopPage();stopSite();};},[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30_000);return()=>clearInterval(timer);},[]);
  const visible=page&&page.active!==false&&(!page.publishAt||new Date(page.publishAt).getTime()<=now)&&(!page.hideAt||new Date(page.hideAt).getTime()>now);
  let html="";if(visible&&page?.bodyRich&&typeof page.bodyRich==="object")try{html=generateHTML(page.bodyRich as Parameters<typeof generateHTML>[0],[StarterKit,TiptapLink,TiptapImage]);}catch{}
  const embed=visible?youtubeEmbed(page?.videoUrl||""):"";
  return <main className="special-page" style={{fontFamily:site.fontFamily} as CSSProperties}><PublicHeader siteName={site.siteName} logoUrl={site.logoUrl} active="special"/>{!ready?<div className="special-empty">페이지를 불러오는 중입니다.</div>:!visible?<div className="special-empty"><CalendarDays/><h1>아직 공개되지 않은 페이지입니다.</h1><Link href="/events">행사 목록 보기</Link></div>:<><header className="special-hero" style={page.coverImageUrl?{backgroundImage:`linear-gradient(90deg,#25181dcc,#25181d55),url(${page.coverImageUrl})`}:undefined}><small>{slug===MOVIE_SLUG?"K-ON! MOVIE RE-RE-RELEASE":"SPECIAL EVENT"}</small><h1>{page.title}</h1><p>{page.summary}</p>{page.eventId&&<Link href={`/events?event=${encodeURIComponent(page.eventId)}`}>행사 신청·예매하기<ArrowRight/></Link>}</header><article className="special-content">{embed?<iframe src={embed} title={`${page.title} 영상`} allowFullScreen/>:page.videoUrl?<video src={page.videoUrl} controls playsInline/>:null}{html?<div className="rich-content" dangerouslySetInnerHTML={{__html:html}}/>:<p>{page.body}</p>}{slug===MOVIE_SLUG&&<MovieAlertPanel/>}</article></>}</main>;
}
