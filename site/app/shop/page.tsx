"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { CircleUserRound } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PublicHeader } from "@/app/components/public-header";

type Product={id:string;name:string;description?:string;price:number;imageUrl?:string;active?:boolean;bankName?:string;accountNumber?:string;accountHolder?:string};
type ShopSettings={bankName?:string;accountNumber?:string;accountHolder?:string};
type Order={id:string;productName:string;amount:number;status:string;createdAt:string;paymentReportedAt?:string;depositorName?:string;buyerRefundReason?:string;adminRefundReason?:string};
const LOGO="https://upload.wikimedia.org/wikipedia/commons/1/17/K-ON_anime_wordmark.svg";
const statusLabel:Record<string,string>={awaiting_transfer:"입금 대기",payment_reported:"입금 확인 중",payment_confirmed:"결제 승인",payment_rejected_refund_pending:"입금 거절 · 환불 예정",refund_requested:"환불 신청 검토 중",refund_rejected:"환불 신청 거절",refund_approved:"환불 진행 중",refunded:"환불 완료",canceled:"주문 취소"};

export default function ShopPage(){
  const [products,setProducts]=useState<Product[]>([]),[user,setUser]=useState<User|null>(null),[settings,setSettings]=useState<ShopSettings>({}),[selected,setSelected]=useState<Product|null>(null),[orders,setOrders]=useState<Order[]>([]),[notice,setNotice]=useState(""),[siteName,setSiteName]=useState("K-ON! FANDOM KR"),[logoUrl,setLogoUrl]=useState(LOGO);
  useEffect(()=>auth?onAuthStateChanged(auth,setUser):undefined,[]);
  useEffect(()=>{if(!db)return;const stop=onSnapshot(query(collection(db,"products"),where("active","==",true)),s=>setProducts(s.docs.map(d=>({id:d.id,...d.data()} as Product))));const accountStop=onSnapshot(collection(db,"shopSettings"),s=>s.docs[0]&&setSettings(s.docs[0].data() as ShopSettings));const siteStop=onSnapshot(doc(db,"siteSettings","main"),s=>{if(!s.exists())return;setSiteName(String(s.data().siteName||"K-ON! FANDOM KR"));setLogoUrl(String(s.data().logoUrl||LOGO));});return()=>{stop();accountStop();siteStop();};},[]);
  useEffect(()=>{if(!db||!user)return;return onSnapshot(query(collection(db,"orders"),where("userId","==",user.uid)),s=>setOrders(s.docs.map(d=>({id:d.id,...d.data()} as Order)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))));},[user]);
  function accountFor(product:Product){return product.accountNumber?{bankName:product.bankName||"은행 미등록",accountNumber:product.accountNumber,accountHolder:product.accountHolder||"예금주 미등록"}:settings;}
  async function placeOrder(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!db||!user||!selected)return;const form=new FormData(e.currentTarget);const account=accountFor(selected);await addDoc(collection(db,"orders"),{userId:user.uid,userEmail:user.email||"",productId:selected.id,productName:selected.name,amount:selected.price,depositorName:String(form.get("depositorName")||""),paymentAccount:account,status:"awaiting_transfer",createdAt:new Date().toISOString()});setSelected(null);setNotice("주문이 접수되었습니다. 해당 상품의 안내 계좌로 송금한 뒤 내 주문에서 입금 완료를 알려주세요.");}
  async function changeOrder(id:string,status:string,extra:Record<string,string>={}){if(!db)return;await updateDoc(doc(db,"orders",id),{status,...extra,updatedAt:new Date().toISOString()});setNotice("주문 상태를 업데이트했습니다.");}
  async function requestRefund(e:FormEvent<HTMLFormElement>,order:Order){e.preventDefault();const reason=String(new FormData(e.currentTarget).get("reason")||"").trim();if(!reason)return;await changeOrder(order.id,"refund_requested",{buyerRefundReason:reason,refundRequestedAt:new Date().toISOString()});}
  return <main className="shop-page">
    <PublicHeader siteName={siteName} logoUrl={logoUrl} active="shop"/>
    <section className="shop-hero page-hero"><div><Link href="/">홈으로</Link><small>FANDOM SHOP</small><h1>팬덤 상점</h1><p>계좌 송금으로 주문하고, 관리자 확인 후 주문이 승인됩니다.</p></div></section>
    <section className="shop-content">{notice&&<p className="shop-notice">{notice}</p>}<div className="transfer-guide"><b>입금 안내</b><span>{settings.bankName&&settings.accountNumber?`${settings.bankName} ${settings.accountNumber} · 예금주 ${settings.accountHolder||"미등록"}`:"관리자가 입금 계좌를 설정 중입니다."}</span><small>입금자명은 주문 시 작성한 이름과 같아야 빠르게 확인할 수 있습니다.</small></div><h2>판매 중인 상품</h2><div className="product-grid">{products.length?products.map(product=><article className="product-card" key={product.id}>{product.imageUrl&&<Image src={product.imageUrl} alt="" width={600} height={400} unoptimized/>}<div><h3>{product.name}</h3><p>{product.description}</p><b>{product.price.toLocaleString("ko-KR")}원</b><Button onClick={()=>user?setSelected(product):setNotice("주문하려면 먼저 로그인해 주세요.")}>주문하기</Button></div></article>):<p className="empty-note">등록된 상품이 없습니다.</p>}</div>
    {user&&<section className="shop-orders"><h2>내 주문</h2>{orders.length?<div className="order-list">{orders.map(order=><article key={order.id}><div><small>{new Date(order.createdAt).toLocaleDateString("ko-KR")}</small><h3>{order.productName}</h3><b>{order.amount.toLocaleString("ko-KR")}원</b><p className={`order-status ${order.status}`}>{statusLabel[order.status]||order.status}</p>{order.adminRefundReason&&<p className="reason"><b>관리자 사유:</b> {order.adminRefundReason}</p>}{order.buyerRefundReason&&<p className="reason"><b>환불 신청 사유:</b> {order.buyerRefundReason}</p>}</div><div className="order-actions">{order.status==="awaiting_transfer"&&<><Button size="sm" onClick={()=>changeOrder(order.id,"payment_reported",{paymentReportedAt:new Date().toISOString()})}>입금 완료 알리기</Button><Button size="sm" variant="outline" onClick={()=>changeOrder(order.id,"canceled")}>주문 취소</Button></>}{["payment_reported","payment_confirmed"].includes(order.status)&&<details><summary>환불 신청</summary><form onSubmit={e=>requestRefund(e,order)}><Textarea name="reason" placeholder="환불 사유를 작성해 주세요" required/><Button size="sm">환불 신청 제출</Button></form></details>}{order.status==="payment_rejected_refund_pending"&&<span className="refund-wait">관리자가 환불을 진행합니다.</span>}</div></article>)}</div>:<p className="empty-note">아직 주문 내역이 없습니다.</p>}</section>}</section>
    <Dialog open={!!selected} onOpenChange={open=>!open&&setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.name} 주문</DialogTitle><DialogDescription>상품별 안내 계좌로 송금해 주세요. 관리자가 입금을 확인하면 승인됩니다.</DialogDescription></DialogHeader><form className="form" onSubmit={placeOrder}><div className="order-account"><small>이 상품의 입금 계좌</small><b>{selected&&accountFor(selected).bankName} {selected&&accountFor(selected).accountNumber}</b><span>예금주 {selected&&accountFor(selected).accountHolder}</span></div><label>입금자명<Input name="depositorName" required placeholder="실제 송금자 이름"/></label><p className="order-total">결제 예정 금액 <b>{selected?.price.toLocaleString("ko-KR")}원</b></p><Button>주문 접수</Button></form></DialogContent></Dialog>
  </main>;
}
