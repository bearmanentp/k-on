"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function MyPage(){
  const [user,setUser]=useState<User|null>(null); const [reservations,setReservations]=useState<Record<string,unknown>[]>([]); const [messages,setMessages]=useState<Record<string,unknown>[]>([]);
  useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,next=>setUser(next));},[]);
  useEffect(()=>{
    if(!user||!db)return;
    const a=onSnapshot(query(collection(db,"reservations"),where("userId","==",user.uid)),s=>setReservations(s.docs.map(d=>({id:d.id,...d.data()}))));
    const b=onSnapshot(query(collection(db,"accountMessages"),where("userId","==",user.uid)),s=>setMessages(s.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{a();b();};
  },[user]);
  if(!user)return <main className="simple-page"><h1>마이페이지</h1><p>로그인 후 내 예약과 알림을 확인할 수 있습니다.</p><Link href="/">홈으로 돌아가기</Link></main>;
  return <main className="simple-page"><nav><Link href="/">K-ON! FANDOM KR</Link><Link href="/events">행사·예약</Link><Link href="/shop">상점</Link></nav><section className="simple-card"><small>MY PAGE</small><h1>{user.displayName||"팬 회원"}</h1><p>{user.email}</p><h2>내 예약</h2>{reservations.length?<ul>{reservations.map(item=><li key={String(item.id)}>{String(item.eventTitle||"행사")} · {String(item.status||"접수")}</li>)}</ul>:<p>예약 내역이 없습니다.</p>}<h2>내 쪽지</h2>{messages.length?<ul>{messages.map(item=><li key={String(item.id)}>{String(item.title||"알림")}</li>)}</ul>:<p>도착한 쪽지가 없습니다.</p>}</section></main>;
}
