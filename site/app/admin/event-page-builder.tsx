"use client";

import { useInput } from "react-admin";
import { useFormContext } from "react-hook-form";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { CalendarClock, GripVertical, Heading, Image as ImageIcon, Link2, Minus, Plus, Space, Text, Timer, Trash2, Video } from "lucide-react";

export type EventPageBlock={
  id:string;
  type:"heading"|"text"|"image"|"video"|"button"|"countdown"|"schedule"|"divider"|"spacer";
  title?:string;
  body?:string;
  imageUrl?:string;
  alt?:string;
  videoUrl?:string;
  label?:string;
  url?:string;
  buttonStyle?:"primary"|"outline";
  targetAt?:string;
  alignment?:"left"|"center"|"right";
  width?:"full"|"half"|"third";
  backgroundColor?:string;
  textColor?:string;
  padding?:"compact"|"normal"|"roomy";
};

const BLOCKS:Array<{type:EventPageBlock["type"];label:string;icon:typeof Heading}>=[
  {type:"heading",label:"제목",icon:Heading},{type:"text",label:"텍스트",icon:Text},{type:"image",label:"이미지",icon:ImageIcon},
  {type:"video",label:"영상",icon:Video},{type:"button",label:"버튼",icon:Link2},{type:"countdown",label:"디데이",icon:Timer},
  {type:"schedule",label:"일정표",icon:CalendarClock},{type:"divider",label:"구분선",icon:Minus},{type:"spacer",label:"여백",icon:Space},
];
const blockLabel=(type:EventPageBlock["type"])=>BLOCKS.find(item=>item.type===type)?.label||type;
const freshBlock=(type:EventPageBlock["type"]):EventPageBlock=>({id:crypto.randomUUID(),type,alignment:"left",width:"full",padding:"normal",buttonStyle:"primary",title:type==="heading"?"새로운 섹션":"",body:type==="text"?"이곳에 내용을 입력하세요.":"",label:type==="button"?"자세히 보기":""});

function BlockEditor({block,index,onChange,onRemove}:{block:EventPageBlock;index:number;onChange:(next:EventPageBlock)=>void;onRemove:()=>void}){
  const {ref,handleRef,isDragging}=useSortable({id:block.id,index});
  const set=(key:keyof EventPageBlock,value:string)=>onChange({...block,[key]:value});
  return <article ref={ref} className={`event-builder-block ${isDragging?"dragging":""}`}>
    <header><button ref={handleRef} type="button" aria-label="블록 순서 이동"><GripVertical/></button><b>{index+1}. {blockLabel(block.type)}</b><button type="button" onClick={onRemove} aria-label="블록 삭제"><Trash2/></button></header>
    <div className="event-builder-fields">
      <label>블록 종류<select value={block.type} onChange={event=>onChange({...freshBlock(event.target.value as EventPageBlock["type"]),id:block.id,width:block.width,alignment:block.alignment})}>{BLOCKS.map(item=><option key={item.type} value={item.type}>{item.label}</option>)}</select></label>
      {block.type==="heading"&&<label className="wide">제목<input value={block.title||""} onChange={event=>set("title",event.target.value)}/></label>}
      {block.type==="text"&&<><label className="wide">소제목<input value={block.title||""} onChange={event=>set("title",event.target.value)}/></label><label className="wide">본문<textarea rows={4} value={block.body||""} onChange={event=>set("body",event.target.value)}/></label></>}
      {block.type==="image"&&<><label className="wide">이미지 URL<input value={block.imageUrl||""} onChange={event=>set("imageUrl",event.target.value)}/></label><label className="wide">대체 설명<input value={block.alt||""} onChange={event=>set("alt",event.target.value)}/></label></>}
      {block.type==="video"&&<label className="wide">YouTube 또는 영상 URL<input value={block.videoUrl||""} onChange={event=>set("videoUrl",event.target.value)}/></label>}
      {block.type==="button"&&<><label>버튼 문구<input value={block.label||""} onChange={event=>set("label",event.target.value)}/></label><label className="wide">이동 링크<input value={block.url||""} onChange={event=>set("url",event.target.value)}/></label><label>버튼 모양<select value={block.buttonStyle||"primary"} onChange={event=>set("buttonStyle",event.target.value)}><option value="primary">강조</option><option value="outline">외곽선</option></select></label></>}
      {block.type==="countdown"&&<><label className="wide">기준 일시<input type="datetime-local" value={block.targetAt||""} onChange={event=>set("targetAt",event.target.value)}/></label><small className="wide">비워 두면 위의 D-Day 기준 일시를 사용합니다.</small></>}
      {block.type==="schedule"&&<small className="wide">위에서 입력한 일정표가 이 위치에 표시됩니다.</small>}
      {!['divider','spacer'].includes(block.type)&&<label>정렬<select value={block.alignment||"left"} onChange={event=>set("alignment",event.target.value)}><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></label>}
      <label>너비<select value={block.width||"full"} onChange={event=>set("width",event.target.value)}><option value="full">전체</option><option value="half">1/2</option><option value="third">1/3</option></select></label>
      <label>안쪽 여백<select value={block.padding||"normal"} onChange={event=>set("padding",event.target.value)}><option value="compact">좁게</option><option value="normal">보통</option><option value="roomy">넓게</option></select></label>
      {!['divider','spacer','image','video'].includes(block.type)&&<><label>배경색<input type="color" value={block.backgroundColor||"#fffaf5"} onChange={event=>set("backgroundColor",event.target.value)}/></label><label>글자색<input type="color" value={block.textColor||"#3e2824"} onChange={event=>set("textColor",event.target.value)}/></label></>}
    </div>
  </article>;
}

function MiniPreview({blocks}:{blocks:EventPageBlock[]}){
  return <aside className="event-builder-preview"><small>LIVE PAGE PREVIEW</small><div>{blocks.length?blocks.map(block=><section key={block.id} className={`width-${block.width||"full"} align-${block.alignment||"left"}`} style={{background:block.backgroundColor||undefined,color:block.textColor||undefined}}>{block.type==="heading"?<h3>{block.title||"제목"}</h3>:block.type==="text"?<><b>{block.title}</b><p>{block.body||"텍스트"}</p></>:block.type==="image"?<div className="preview-media"><ImageIcon/><span>{block.alt||"이미지"}</span></div>:block.type==="video"?<div className="preview-media"><Video/><span>영상</span></div>:block.type==="button"?<button type="button">{block.label||"버튼"}</button>:block.type==="countdown"?<strong>D-00 : 00 : 00</strong>:block.type==="schedule"?<div className="preview-schedule"><CalendarClock/> 일정표</div>:block.type==="divider"?<hr/>:<div className="preview-spacer"/>}</section>):<p className="event-builder-empty">왼쪽에서 블록을 추가하면 실제 배치를 미리 볼 수 있습니다.</p>}</div></aside>;
}

export function EventPageBuilder({source="contentBlocks"}:{source?:string}){
  const {field}=useInput({source});
  const {watch}=useFormContext();
  const raw=Array.isArray(field.value)?field.value:[];
  const blocks:EventPageBlock[]=raw.map((item:Partial<EventPageBlock>,index:number)=>({...item,id:item.id||`block-${index}`} as EventPageBlock));
  const change=(next:EventPageBlock[])=>field.onChange(next);
  const add=(type:EventPageBlock["type"])=>change([...blocks,freshBlock(type)]);
  const starter=()=>change([
    {...freshBlock("heading"),title:String(watch("title")||"이벤트 안내")},
    {...freshBlock("text"),title:"이벤트 소개",body:String(watch("summary")||"이벤트의 자세한 내용을 입력하세요.")},
    freshBlock("countdown"),freshBlock("button"),freshBlock("schedule"),
  ]);
  return <section className="event-page-builder">
    <header><div><small>DRAG & DROP PAGE BUILDER</small><h2>자유 배치 페이지 편집기</h2><p>블록을 추가하고 끌어서 순서를 바꾸세요. 너비를 조합하면 2단·3단 배치도 만들 수 있습니다.</p></div><button type="button" onClick={starter}>추천 구성 적용</button></header>
    <nav aria-label="추가할 콘텐츠 블록">{BLOCKS.map(item=>{const Icon=item.icon;return <button key={item.type} type="button" onClick={()=>add(item.type)}><Icon/>{item.label}<Plus/></button>})}</nav>
    <div className="event-builder-workspace"><div className="event-builder-canvas"><DragDropProvider onDragEnd={event=>change(move(blocks,event) as EventPageBlock[])}>{blocks.map((block,index)=><BlockEditor key={block.id} block={block} index={index} onChange={next=>change(blocks.map(item=>item.id===block.id?next:item))} onRemove={()=>change(blocks.filter(item=>item.id!==block.id))}/>)}</DragDropProvider>{!blocks.length&&<button className="event-builder-start" type="button" onClick={starter}><Plus/>추천 구성으로 시작하기</button>}</div><MiniPreview blocks={blocks}/></div>
  </section>;
}
