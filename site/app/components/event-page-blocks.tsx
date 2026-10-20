"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Clock3, MapPin } from "lucide-react";
import type { EventPageBlock } from "@/app/admin/event-page-builder";

type ScheduleItem={startAt:string;endAt?:string;title:string;description?:string;place?:string};
function youtubeEmbed(url:string){const match=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&/]+)/);return match?`https://www.youtube.com/embed/${match[1]}`:"";}
function remaining(target:string,now:number){const difference=new Date(target).getTime()-now;if(!Number.isFinite(difference))return null;const value=Math.abs(difference);return{past:difference<0,days:Math.floor(value/86400000),hours:Math.floor((value%86400000)/3600000),minutes:Math.floor((value%3600000)/60000)};}
function Countdown({target,now}:{target:string;now:number}){const value=remaining(target,now);if(!value)return null;return <div className="event-countdown block-countdown"><span>{value.past?"EVENT STARTED":`D-${value.days}`}</span><b>{value.days}<small>일</small></b><b>{value.hours}<small>시간</small></b><b>{value.minutes}<small>분</small></b></div>}
function Schedule({items}:{items:ScheduleItem[]}){return <section className="event-schedule block-schedule"><header><small>EVENT SCHEDULE</small><h2><CalendarClock/>일정표</h2></header><div>{items.map((item,index)=><article key={`${item.startAt}-${index}`}><time><Clock3/>{new Date(item.startAt).toLocaleString("ko-KR",{month:"long",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit"})}{item.endAt&&<> – {new Date(item.endAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}</>}</time><h3>{item.title}</h3>{item.description&&<p>{item.description}</p>}{item.place&&<span><MapPin/>{item.place}</span>}</article>)}</div></section>}

export function EventPageBlocks({blocks,scheduleItems,eventStartAt,now}:{blocks:EventPageBlock[];scheduleItems:ScheduleItem[];eventStartAt?:string;now:number}){
  if(!blocks.length)return null;
  return <div className="event-content-blocks">{blocks.map(block=>{const embed=block.type==="video"?youtubeEmbed(block.videoUrl||""):"";const style={backgroundColor:block.backgroundColor||undefined,color:block.textColor||undefined} as React.CSSProperties;return <section key={block.id} className={`event-content-block type-${block.type} width-${block.width||"full"} align-${block.alignment||"left"} pad-${block.padding||"normal"}`} style={style}>
    {block.type==="heading"&&<h2>{block.title}</h2>}
    {(block.type==="text"||block.type==="card")&&<>{block.title&&<h3>{block.title}</h3>}<p>{block.body}</p></>}
    {block.type==="image"&&block.imageUrl&&<img src={block.imageUrl} alt={block.alt||"이벤트 이미지"}/>}
    {block.type==="video"&&(embed?<iframe src={embed} title="이벤트 영상" allowFullScreen/>:block.videoUrl?<video src={block.videoUrl} controls playsInline/>:null)}
    {block.type==="button"&&block.url&&(/^https?:\/\//i.test(block.url)?<a className={block.buttonStyle||"primary"} href={block.url} target="_blank" rel="noreferrer">{block.label||"자세히 보기"}<ArrowRight/></a>:<Link className={block.buttonStyle||"primary"} href={block.url}>{block.label||"자세히 보기"}<ArrowRight/></Link>)}
    {block.type==="countdown"&&(block.targetAt||eventStartAt)&&<Countdown target={block.targetAt||eventStartAt||""} now={now}/>}
    {block.type==="schedule"&&scheduleItems.length>0&&<Schedule items={scheduleItems}/>}
    {block.type==="divider"&&<hr/>}
  </section>})}</div>;
}
