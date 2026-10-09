"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Bell, CalendarDays, ChevronRight, CircleUserRound, Settings2, Sparkles, TicketCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth, db } from "@/lib/firebase";
import { authErrorMessage, claimNickname } from "@/lib/auth";
import { PublicHeader } from "@/app/components/public-header";

type Reservation = { id:string; eventTitle?:string; createdAt?:string; status?:string; seatLabel?:string };
type AccountMessage = { id:string; title?:string; body?:string; createdAt?:string; read?:boolean };
type MemberProfile = { nickname?:string; points?:number; nicknameChangedAt?:string; referralCode?:string; memberNumber?:number };

const statusLabel:Record<string,string> = {received:"접수",reviewing:"검토 중",confirmed:"확정",completed:"안내 완료",canceled:"취소"};
const LOGO="https://upload.wikimedia.org/wikipedia/commons/1/17/K-ON_anime_wordmark.svg";

function displayDate(value?:string){
  if(!value)return "날짜 미정";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"날짜 미정":date.toLocaleDateString("ko-KR",{year:"numeric",month:"short",day:"numeric"});
}

export default function MyPage(){
  const [user,setUser]=useState<User|null>(null);
  const [authReady,setAuthReady]=useState(!auth);
  const [profile,setProfile]=useState<MemberProfile>({});
  const [reservations,setReservations]=useState<Reservation[]>([]);
  const [messages,setMessages]=useState<AccountMessage[]>([]);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [siteName,setSiteName]=useState("K-ON! FANDOM KR"),[logoUrl,setLogoUrl]=useState(LOGO);

  useEffect(()=>{
    if(!auth)return;
    return onAuthStateChanged(auth,next=>{setUser(next);setAuthReady(true);});
  },[]);
  useEffect(()=>{
    if(!user||!db)return;
    const stopProfile=onSnapshot(doc(db,"users",user.uid),snapshot=>setProfile((snapshot.data()||{}) as MemberProfile));
    const stopReservations=onSnapshot(query(collection(db,"reservations"),where("userId","==",user.uid)),snapshot=>setReservations(snapshot.docs.map(item=>({id:item.id,...item.data()}) as Reservation)));
    const stopMessages=onSnapshot(query(collection(db,"accountMessages"),where("userId","==",user.uid)),snapshot=>setMessages(snapshot.docs.map(item=>({id:item.id,...item.data()}) as AccountMessage)));
    return()=>{stopProfile();stopReservations();stopMessages();};
  },[user]);
  useEffect(()=>{if(!db)return;return onSnapshot(doc(db,"siteSettings","main"),snapshot=>{if(!snapshot.exists())return;setSiteName(String(snapshot.data().siteName||"K-ON! FANDOM KR"));setLogoUrl(String(snapshot.data().logoUrl||LOGO));});},[]);

  const sortedReservations=useMemo(()=>[...reservations].sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))),[reservations]);
  const sortedMessages=useMemo(()=>[...messages].sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))),[messages]);
  const nickname=profile.nickname||user?.displayName||"";
  const unreadCount=messages.filter(message=>!message.read).length;

  async function saveProfile(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!user||!db){setNotice("프로필 저장 기능을 사용할 수 없습니다.");return;}
    const value=String(new FormData(event.currentTarget).get("nickname")||"").trim();
    if(value.length<2||value.length>20){setNotice("닉네임은 2~20자로 입력해 주세요.");return;}
    setSaving(true);setNotice("");
    try{
      await claimNickname(db,user,value,String(new FormData(event.currentTarget).get("referralCode")||""));
      await updateProfile(user,{displayName:value});
      setProfile(current=>({...current,nickname:value}));
      setNotice(nickname?"프로필을 수정했습니다.":"프로필 등록을 완료했습니다.");
    }catch(error){setNotice(authErrorMessage(error));}
    finally{setSaving(false);}
  }

  const siteFooter=<footer className="site-footer"><div className="brand"><Image src={logoUrl} alt="" width={124} height={44} unoptimized/><span>{siteName}</span></div><p>팬덤 작성 콘텐츠는 각 작성자에게 권리가 있으며, K-ON! 원작·상표·캐릭터의 권리는 각 권리자에게 있습니다. 비영리 비공식 팬 커뮤니티입니다.</p></footer>;

  if(!authReady)return <main className="mypage-loading">마이페이지를 불러오는 중입니다.</main>;
  if(!user)return <main className="mypage-page"><PublicHeader siteName={siteName} logoUrl={logoUrl} active="mypage"/><section className="mypage-login-card"><CircleUserRound/><small>MEMBER ONLY</small><h1>로그인 후 이용해 주세요</h1><p>프로필 등록과 예약 내역, 회원 쪽지를 한곳에서 확인할 수 있습니다.</p><Button asChild><Link href="/">홈에서 로그인하기</Link></Button></section>{siteFooter}</main>;

  return <main className="mypage-page">
    <PublicHeader siteName={siteName} logoUrl={logoUrl} active="mypage"/>
    <header className="mypage-hero"><div className="mypage-avatar" aria-hidden="true">{(nickname||user.email||"K").slice(0,1).toUpperCase()}</div><div className="mypage-identity"><small>MY FAN PROFILE</small><h1>{nickname||"프로필을 등록해 주세요"}</h1><p>{user.email}</p></div><div className="mypage-stats" aria-label="회원 활동 요약"><div><strong>{Number(profile.points||0).toLocaleString()}P</strong><span>보유 포인트</span></div><div><strong>{reservations.length}</strong><span>예약</span></div><div><strong>{unreadCount}</strong><span>읽지 않은 쪽지</span></div></div></header>
    <div className="mypage-grid">
      <section id="settings" className="mypage-panel mypage-profile-panel"><div className="mypage-panel-heading"><span><Settings2/></span><div><small>PROFILE</small><h2>프로필 설정</h2></div></div><p className="mypage-panel-description">커뮤니티에서 사용할 닉네임을 등록하세요. 닉네임은 중복 사용할 수 없으며 변경 후 30일 동안 다시 바꿀 수 없습니다.</p><form className="mypage-profile-form" onSubmit={saveProfile}><label htmlFor="nickname">닉네임</label><Input id="nickname" name="nickname" defaultValue={nickname} minLength={2} maxLength={20} placeholder="2~20자 닉네임" required/>{!profile.referralCode&&<><label htmlFor="referralCode">친구 추천 코드</label><Input id="referralCode" name="referralCode" placeholder="선택 입력"/></>}<p>한글, 영문, 숫자, 공백과 일부 기호(_ . -)를 사용할 수 있습니다.</p>{profile.referralCode&&<p><b>친구 추천 코드:</b> {profile.referralCode}{profile.memberNumber?` · ${profile.memberNumber}번째 회원`:""}</p>}<Button disabled={saving}>{saving?"저장 중…":nickname?"프로필 수정":"프로필 등록"}</Button>{notice&&<div className="mypage-notice" role="status">{notice}</div>}</form></section>
      <section className="mypage-panel"><div className="mypage-panel-heading"><span><TicketCheck/></span><div><small>RESERVATION</small><h2>내 예약</h2></div><Link href="/events" aria-label="행사 예약 페이지로 이동"><ChevronRight/></Link></div><div className="mypage-list">{sortedReservations.length?sortedReservations.slice(0,4).map(item=><article key={item.id}><div><strong>{item.eventTitle||"팬 행사"}{item.seatLabel&&` · ${item.seatLabel} 좌석`}</strong><time>{displayDate(item.createdAt)}</time></div><span className={`mypage-status ${item.status||"received"}`}>{statusLabel[item.status||""]||item.status||"접수"}</span></article>):<div className="mypage-empty"><CalendarDays/><p>아직 예약한 행사가 없습니다.</p><Link href="/events">행사 둘러보기</Link></div>}</div></section>
      <section className="mypage-panel mypage-message-panel"><div className="mypage-panel-heading"><span><Bell/></span><div><small>MESSAGE</small><h2>내 쪽지</h2></div></div><div className="mypage-list">{sortedMessages.length?sortedMessages.slice(0,5).map(message=><article key={message.id} className={message.read?"":"unread"}><span className="mypage-message-dot" aria-label={message.read?"읽음":"읽지 않음"}/><div><strong>{message.title||"회원 알림"}</strong><p>{message.body||"새로운 안내가 도착했습니다."}</p><time>{displayDate(message.createdAt)}</time></div></article>):<div className="mypage-empty"><Sparkles/><p>도착한 쪽지가 없습니다.</p></div>}</div></section>
    </div>
    {siteFooter}
  </main>;
}
