"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import TiptapImage from "@tiptap/extension-image";
import { X } from "lucide-react";
import { db } from "@/lib/firebase";

type Popup={id:string;title?:string;summary?:string;body?:string;bodyRich?:unknown;imageUrl?:string;videoUrl?:string;linkUrl?:string;linkLabel?:string;publishAt?:string;hideAt?:string;active?:boolean;dismissible?:boolean};
function richHtml(popup:Popup){if(!popup.bodyRich||typeof popup.bodyRich!=="object")return"";try{return generateHTML(popup.bodyRich as Parameters<typeof generateHTML>[0],[StarterKit,TiptapLink,TiptapImage]);}catch{return"";}}
function youtubeEmbed(url:string){const match=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&/]+)/);return match?`https://www.youtube.com/embed/${match[1]}`:"";}
export function SitePopup(){
  const [popups,setPopups]=useState<Popup[]>([]),[closed,setClosed]=useState<string[]>([]),[now,setNow]=useState(()=>Date.now());
  useEffect(()=>{if(!db)return;return onSnapshot(query(collection(db,"sitePopups"),orderBy("createdAt","desc")),snapshot=>setPopups(snapshot.docs.map(item=>({id:item.id,...item.data()}) as Popup)));},[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30_000);return()=>clearInterval(timer);},[]);
  const popup=useMemo(()=>popups.find(item=>item.active!==false&&!closed.includes(item.id)&&(!item.publishAt||new Date(item.publishAt).getTime()<=now)&&(!item.hideAt||new Date(item.hideAt).getTime()>now)),[popups,closed,now]);
  if(!popup)return null;
  const html=richHtml(popup),embed=youtubeEmbed(popup.videoUrl||"");
  return <div className="site-popup-backdrop" role="dialog" aria-modal="true" aria-label={popup.title||"사이트 안내"}><article className="site-popup-card">{popup.dismissible!==false&&<button className="site-popup-close" onClick={()=>setClosed(current=>[...current,popup.id])} aria-label="팝업 닫기"><X/></button>}{popup.imageUrl&&<img src={popup.imageUrl} alt=""/>}{embed?<iframe src={embed} title={popup.title||"안내 영상"} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>:popup.videoUrl?<video src={popup.videoUrl} controls playsInline/>:null}<div className="site-popup-copy"><small>IMPORTANT NOTICE</small><h2>{popup.title}</h2>{popup.summary&&<p>{popup.summary}</p>}{html?<div className="rich-content" dangerouslySetInnerHTML={{__html:html}}/>:popup.body&&<p>{popup.body}</p>}{popup.linkUrl&&<a href={popup.linkUrl}>{popup.linkLabel||"자세히 보기"}</a>}</div></article></div>;
}
