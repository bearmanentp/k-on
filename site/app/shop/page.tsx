"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
type Product={id:string;name:string;description?:string;price:number;imageUrl?:string;active?:boolean};
export default function ShopPage(){const [products,setProducts]=useState<Product[]>([]);useEffect(()=>{if(!db)return;return onSnapshot(query(collection(db,"products"),where("active","==",true)),s=>setProducts(s.docs.map(d=>({id:d.id,...d.data()} as Product))));},[]);return <main className="simple-page shop-page"><nav><Link href="/">K-ON! FANDOM KR</Link><Link href="/mypage">마이페이지</Link><Link href="/events">행사·예약</Link></nav><section className="simple-card"><small>FANDOM SHOP</small><h1>팬덤 상점</h1><p>관리자가 등록한 굿즈와 상품을 확인하세요.</p><div className="product-grid">{products.length?products.map(product=><article className="product-card" key={product.id}>{product.imageUrl&&<Image src={product.imageUrl} alt="" width={300} height={200} unoptimized/>}<h2>{product.name}</h2><p>{product.description}</p><b>{product.price.toLocaleString("ko-KR")}원</b></article>):<p>등록된 상품이 없습니다.</p>}</div></section></main>}
