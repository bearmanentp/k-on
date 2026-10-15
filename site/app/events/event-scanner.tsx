"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { Camera, ScanLine, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkInTicket, type TicketReservation } from "@/lib/tickets";

export function EventScanner({firestore,user,event}:{firestore:Firestore;user:User;event:{id:string;title:string}}){
  const rawId=useId(),readerId=`ticket-scanner-${rawId.replace(/[^a-zA-Z0-9_-]/g,"")}`;
  const scannerRef=useRef<import("html5-qrcode").Html5Qrcode|null>(null);
  const busyRef=useRef(false);
  const [running,setRunning]=useState(false),[message,setMessage]=useState(""),[lastTicket,setLastTicket]=useState<TicketReservation|null>(null);
  useEffect(()=>()=>{scannerRef.current?.stop().catch(()=>undefined);scannerRef.current?.clear();},[]);
  async function start(){
    setMessage("");
    try{
      const {Html5Qrcode}=await import("html5-qrcode");
      const scanner=new Html5Qrcode(readerId);
      scannerRef.current=scanner;
      const cameras=await Html5Qrcode.getCameras();
      if(!cameras.length)throw new Error("사용 가능한 카메라가 없습니다.");
      await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:240,height:240}},async decoded=>{
        if(busyRef.current)return;
        busyRef.current=true;
        try{const ticket=await checkInTicket(firestore,user,event.id,decoded);setLastTicket(ticket);setMessage(`${ticket.userEmail||"회원"} · ${ticket.seatLabel||"일반 입장"} 입장 처리 완료`);}
        catch(error){setMessage(error instanceof Error?error.message:"QR 확인에 실패했습니다.");}
        finally{setTimeout(()=>{busyRef.current=false;},1800);}
      },()=>undefined);
      setRunning(true);
    }catch(error){setMessage(error instanceof Error?error.message:"카메라를 시작하지 못했습니다.");}
  }
  async function stop(){await scannerRef.current?.stop().catch(()=>undefined);scannerRef.current?.clear();scannerRef.current=null;setRunning(false);}
  return <section className="event-scanner"><div><small>EVENT STAFF</small><h2><ScanLine/>QR 입장 확인</h2><p>{event.title} 행사 담당자 전용 · 행사 당일에만 사용할 수 있습니다.</p></div><div id={readerId} className="event-scanner-camera"/>{running?<Button type="button" variant="outline" onClick={stop}><Square/>스캔 종료</Button>:<Button type="button" onClick={start}><Camera/>카메라로 QR 스캔</Button>}{message&&<p className={lastTicket?"success":""}>{message}</p>}</section>;
}
