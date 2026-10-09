"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, where } from "firebase/firestore";
import { createColumnHelper, tableFeatures } from "@tanstack/table-core";
import { flexRender, useTable } from "@tanstack/react-table";
import { usePermissions } from "react-admin";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { EventFormBuilder } from "./form-builder";
import { PermissionManager } from "./permission-manager";

type InquiryRow={id:string;title:string;userEmail:string;status:string;createdAt:string};
type StorageAlert={status:"normal"|"warning"|"critical";usedBytes:number;warningBytes:number;criticalBytes:number;message:string;updatedAt:string};
const features=tableFeatures({});
const helper=createColumnHelper<typeof features,InquiryRow>();
const columns=helper.columns([
  helper.accessor("userEmail",{header:"회원"}),
  helper.accessor("title",{header:"최근 문의"}),
  helper.accessor("status",{header:"상태",cell:info=>info.getValue()==="answered"?"답변 완료":"답변 대기"}),
  helper.accessor("createdAt",{header:"작성일",cell:info=>new Date(info.getValue()).toLocaleDateString("ko-KR")}),
]);

export function AdminDashboard(){
  const [inquiries,setInquiries]=useState<InquiryRow[]>([]),[storageAlert,setStorageAlert]=useState<StorageAlert|null>(null);
  const {permissions}=usePermissions();
  useEffect(()=>{if(!db)return;const recentQuery=query(collection(db,"inquiries"),orderBy("createdAt","desc"),limit(6));return onSnapshot(recentQuery,snapshot=>setInquiries(snapshot.docs.map(item=>({id:item.id,...item.data()} as InquiryRow))));},[]);
  useEffect(()=>{if(!db)return;return onSnapshot(doc(db,"adminAlerts","storage-capacity"),snapshot=>setStorageAlert(snapshot.exists()?snapshot.data() as StorageAlert:null));},[]);
  const data=useMemo(()=>inquiries,[inquiries]);
  const table=useTable({features,columns,data,getRowId:row=>row.id});
  return <div className="ra-dashboard"><div className="dashboard-welcome"><small>K-ON! CONTROL CENTER</small><h1>관리 시스템</h1><p>왼쪽 메뉴에서 게시판, 행사, 문의와 예약 데이터를 통합 관리하세요.</p></div>{storageAlert&&storageAlert.status!=="normal"&&<section className={`storage-alert ${storageAlert.status}`}><b>Firebase 이미지 저장공간 경고</b><strong>{storageAlert.status==="critical"?"위험":"주의"}</strong><p>{storageAlert.message}</p><small>{formatBytes(storageAlert.usedBytes)} 사용 · 경고 기준 {formatBytes(storageAlert.warningBytes)} · {new Date(storageAlert.updatedAt).toLocaleString("ko-KR")}</small></section>}{(permissions.includes("owner")||permissions.includes("points"))&&<PointManager/>}<PermissionManager/><section className="dashboard-latest"><h2>최근 문의</h2><div className="tanstack-table"><table><thead>{table.getHeaderGroups().map(group=><tr key={group.id}>{group.headers.map(header=><th key={header.id}>{header.isPlaceholder?null:flexRender(header.column.columnDef.header,header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map(row=><tr key={row.id}>{row.getAllCells().map(cell=><td key={cell.id}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</td>)}</tr>)}</tbody></table></div></section><EventFormBuilder/></div>;
}

function formatBytes(value:number){if(!value)return "0 B";const units=["B","KB","MB","GB","TB"];const index=Math.min(Math.floor(Math.log(value)/Math.log(1024)),units.length-1);return `${(value/1024**index).toFixed(index?1:0)} ${units[index]}`;}

function PointManager(){const [email,setEmail]=useState(""),[delta,setDelta]=useState(""),[reason,setReason]=useState(""),[message,setMessage]=useState("");async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!db||!auth?.currentUser)return setMessage("Firebase 연결이 필요합니다.");const firestore=db,currentUser=auth.currentUser,normalizedEmail=email.trim().toLowerCase(),amount=Number(delta);if(!Number.isInteger(amount)||amount===0||Math.abs(amount)>100000)return setMessage("0이 아닌 정수 포인트를 입력해 주세요.");try{const matches=await getDocs(query(collection(firestore,"users"),where("email","==",normalizedEmail),limit(1)));const target=matches.docs[0];if(!target)throw new Error("해당 이메일의 회원을 찾을 수 없습니다.");let balance=0;await runTransaction(firestore,async transaction=>{const userRef=doc(firestore,"users",target.id),snapshot=await transaction.get(userRef);balance=Math.max(0,Number(snapshot.data()?.points||0)+amount);transaction.update(userRef,{points:balance,pointsUpdatedAt:new Date().toISOString()});transaction.set(doc(collection(firestore,"pointHistory")),{userId:target.id,userEmail:normalizedEmail,delta:amount,balance,reason:(reason||"관리자 지급").trim().slice(0,200),createdAt:new Date().toISOString(),createdBy:currentUser.uid});});setMessage(`${normalizedEmail} 회원의 포인트 잔액이 ${balance.toLocaleString()}P가 되었습니다.`);setEmail("");setDelta("");setReason("");}catch(error){setMessage(error instanceof Error?error.message:"포인트 지급에 실패했습니다.");}}return <section className="point-manager"><div><small>MEMBER REWARD</small><h2>회원 포인트 지급</h2><p>회원 이메일과 포인트를 입력하면 지급 이력이 남습니다. 차감은 음수로 입력하세요.</p></div><form onSubmit={submit}><input name="email" type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="member@example.com" required/><input name="delta" type="number" value={delta} onChange={event=>setDelta(event.target.value)} placeholder="지급 포인트 (예: 100)" required/><input name="reason" value={reason} onChange={event=>setReason(event.target.value)} placeholder="지급 사유"/><button>포인트 저장</button>{message&&<p className="point-result">{message}</p>}</form></section>}
