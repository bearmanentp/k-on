"use client";

import { FormEvent, useState } from "react";
import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { Download, Gift, QrCode, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTicketGift,
  downloadTicketPng,
  refreshTicketQr,
  ticketQrAvailable,
  ticketQrDataUrl,
  type TicketReservation,
} from "@/lib/tickets";

export function TicketCard({firestore,user,ticket:initialTicket}:{firestore:Firestore;user:User;ticket:TicketReservation}){
  const [ticket,setTicket]=useState(initialTicket),[qrUrl,setQrUrl]=useState(""),[loading,setLoading]=useState(false),[message,setMessage]=useState("");
  const qrAvailable=ticketQrAvailable(ticket);
  async function openTicket(event:React.SyntheticEvent<HTMLDetailsElement>){
    if(!event.currentTarget.open||!qrAvailable||loading)return;
    setLoading(true);setMessage("");
    try{const refreshed=await refreshTicketQr(firestore,user,ticket);setTicket(refreshed);setQrUrl(await ticketQrDataUrl(refreshed));}
    catch(error){setMessage(error instanceof Error?error.message:"QR을 만들지 못했습니다.");}
    finally{setLoading(false);}
  }
  async function regenerate(){setQrUrl("");setLoading(true);try{const refreshed=await refreshTicketQr(firestore,user,ticket);setTicket(refreshed);setQrUrl(await ticketQrDataUrl(refreshed));setMessage("새 QR로 갱신했습니다. 이전 QR은 사용할 수 없습니다.");}catch(error){setMessage(error instanceof Error?error.message:"QR 갱신에 실패했습니다.");}finally{setLoading(false);}}
  async function gift(event:FormEvent<HTMLFormElement>){event.preventDefault();const email=String(new FormData(event.currentTarget).get("recipientEmail")||"");setLoading(true);try{await createTicketGift(firestore,user,ticket,email);setMessage(`${email.trim()} 계정으로 선물을 보냈습니다.`);event.currentTarget.reset();}catch(error){setMessage(error instanceof Error?error.message:"선물 전송에 실패했습니다.");}finally{setLoading(false);}}
  return <details className="ticket-card" onToggle={openTicket}><summary><span><small>EVENT TICKET</small><b>{ticket.eventTitle||"팬 행사"}</b><em>{ticket.timeSlotLabel||ticket.eventStartAt||"일정 확인"}{ticket.seatLabel?` · ${ticket.seatLabel} 좌석`:""}</em></span><strong>{ticket.status==="canceled"?"취소":ticket.checkInAt?"입장 완료":"티켓 보기"}</strong></summary><div className="ticket-card-body"><div className="ticket-visual"><div><small>K-ON! FANDOM KR</small><h3>{ticket.eventTitle}</h3><p>{ticket.timeSlotLabel||ticket.eventStartAt||"일정 확인"}</p><p>{ticket.seatLabel?`${ticket.seatLabel} 좌석`:"일반 입장"}</p><code>{ticket.ticketCode||ticket.id}</code></div><div className="ticket-qr">{!qrAvailable?<><QrCode/><b>QR 공개 전</b><small>{ticket.qrRevealAt?new Date(ticket.qrRevealAt).toLocaleString("ko-KR"):"행사 안내를 확인하세요"}</small></>:loading?<><RotateCw className="spin"/><b>새 QR 발급 중</b></>:qrUrl?<img src={qrUrl} alt="입장 확인 QR 코드"/>:<><QrCode/><b>티켓을 다시 열어 주세요</b></>}</div></div><div className="ticket-actions"><Button type="button" variant="outline" onClick={()=>downloadTicketPng(ticket)}><Download/>사진으로 저장</Button>{qrAvailable&&<Button type="button" variant="outline" onClick={regenerate}><RotateCw/>QR 새로 갱신</Button>}</div><form className="ticket-gift-form" onSubmit={gift}><label><Gift/>가입 회원에게 티켓 선물</label><div><Input type="email" name="recipientEmail" placeholder="받는 사람의 가입 이메일" required/><Button disabled={loading}>선물하기</Button></div><small>친구 기능 없이 가입한 계정 이메일로만 받을 수 있습니다.</small></form>{message&&<p className="ticket-message">{message}</p>}</div></details>;
}
