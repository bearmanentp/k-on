"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { ChevronDown, CircleUserRound, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { readAdminAccess } from "@/lib/admin-access";
import { ensureMemberProfile } from "@/lib/auth";

export function AccountMenu({onLogin,onSettings}:{onLogin?:()=>void;onSettings?:()=>void}){
  const [user,setUser]=useState<User|null>(auth?.currentUser||null),[nickname,setNickname]=useState(""),[isAdmin,setIsAdmin]=useState(false);
  useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,async next=>{setUser(next);setIsAdmin(false);if(!next||!db)return;await ensureMemberProfile(db,next).catch(()=>undefined);const access=await readAdminAccess(next,db);setIsAdmin(access.role==="owner"||access.role==="deputy"||access.permissions.length>0);});},[]);
  useEffect(()=>{setNickname("");if(!db||!user)return;return onSnapshot(doc(db,"users",user.uid),snapshot=>setNickname(String(snapshot.data()?.nickname||user.displayName||"")));},[user]);
  if(!user)return onLogin?<button type="button" className="account-login" onClick={onLogin}><CircleUserRound/>로그인</button>:<Link className="account-login" href="/"><CircleUserRound/>로그인</Link>;
  const label=nickname||user.displayName||user.email?.split("@")[0]||"회원";
  return <details className="account-menu"><summary><CircleUserRound/><span>{label}</span><ChevronDown/></summary><div className="account-menu-popover"><div className="account-menu-identity"><b>{label}</b><small>{user.email}</small></div>{isAdmin&&<Link href="/admin"><ShieldCheck/>관리 시스템</Link>}<Link href="/mypage"><UserRound/>마이페이지</Link>{onSettings?<button type="button" onClick={onSettings}><Settings/>내 설정</button>:<Link href="/mypage#settings"><Settings/>내 설정</Link>}<button type="button" onClick={()=>auth&&signOut(auth)}><LogOut/>로그아웃</button></div></details>;
}
