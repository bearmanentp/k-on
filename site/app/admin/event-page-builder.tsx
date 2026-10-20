"use client";

import { useState } from "react";
import { useInput } from "react-admin";
import { useFormContext } from "react-hook-form";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { CalendarClock, Columns2, Columns3, Copy, GripVertical, Heading, Image as ImageIcon, Link2, Minus, Palette, Plus, Space, Square, Text, Timer, Trash2, Video } from "lucide-react";

export type EventPageBlock={
  id:string;
  type:"heading"|"text"|"card"|"image"|"video"|"button"|"countdown"|"schedule"|"divider"|"spacer";
  title?:string;body?:string;imageUrl?:string;alt?:string;videoUrl?:string;label?:string;url?:string;
  buttonStyle?:"primary"|"outline";targetAt?:string;alignment?:"left"|"center"|"right";
  width?:"full"|"half"|"third";backgroundColor?:string;textColor?:string;padding?:"compact"|"normal"|"roomy";
};

const BLOCKS:Array<{type:EventPageBlock["type"];label:string;icon:typeof Heading}>=[
  {type:"heading",label:"제목",icon:Heading},{type:"text",label:"텍스트",icon:Text},{type:"card",label:"박스",icon:Square},
  {type:"image",label:"이미지",icon:ImageIcon},{type:"video",label:"영상",icon:Video},{type:"button",label:"버튼",icon:Link2},
  {type:"countdown",label:"디데이",icon:Timer},{type:"schedule",label:"일정표",icon:CalendarClock},{type:"divider",label:"구분선",icon:Minus},{type:"spacer",label:"여백",icon:Space},
];
const blockLabel=(type:EventPageBlock["type"])=>BLOCKS.find(item=>item.type===type)?.label||type;
const freshBlock=(type:EventPageBlock["type"],width:EventPageBlock["width"]="full"):EventPageBlock=>({id:crypto.randomUUID(),type,width,alignment:"left",padding:type==="card"?"roomy":"normal",buttonStyle:"primary",backgroundColor:type==="card"?"#fff0e9":"#fffaf5",textColor:"#3e2824",title:type==="heading"?"새로운 섹션":type==="card"?"새로운 박스":"",body:["text","card"].includes(type)?"이곳을 눌러 내용을 바로 수정하세요.":"",label:type==="button"?"새 버튼":""});

function Editable({value,placeholder,className,onChange}:{value?:string;placeholder:string;className:string;onChange:(value:string)=>void}){
  return <div className={className} contentEditable suppressContentEditableWarning data-placeholder={placeholder} onBlur={event=>onChange(event.currentTarget.textContent||"")}>{value}</div>;
}

function CanvasBlock({block,index,selected,onSelect,onChange,onRemove,onDuplicate,onInsert}:{block:EventPageBlock;index:number;selected:boolean;onSelect:()=>void;onChange:(next:EventPageBlock)=>void;onRemove:()=>void;onDuplicate:()=>void;onInsert:()=>void}){
  const {ref,handleRef,isDragging}=useSortable({id:block.id,index});
  const set=(key:keyof EventPageBlock,value:string)=>onChange({...block,[key]:value});
  return <article ref={ref} onClick={event=>{event.stopPropagation();onSelect();}} className={`event-canvas-block type-${block.type} width-${block.width||"full"} align-${block.alignment||"left"} pad-${block.padding||"normal"} ${selected?"selected":""} ${isDragging?"dragging":""}`} style={{backgroundColor:block.backgroundColor||undefined,color:block.textColor||undefined}}>
    <div className="event-canvas-controls">
      <button ref={handleRef} type="button" title="끌어서 이동"><GripVertical/></button><span>{blockLabel(block.type)}</span>
      <div className="event-width-switch" aria-label="블록 너비"><button type="button" className={block.width==="third"?"active":""} onClick={()=>set("width","third")}>⅓</button><button type="button" className={block.width==="half"?"active":""} onClick={()=>set("width","half")}>½</button><button type="button" className={(block.width||"full")==="full"?"active":""} onClick={()=>set("width","full")}>전체</button></div>
      <button type="button" title="복제" onClick={onDuplicate}><Copy/></button><button type="button" title="아래에 텍스트 추가" onClick={onInsert}><Plus/></button><button type="button" title="삭제" onClick={onRemove}><Trash2/></button>
    </div>
    <div className="event-canvas-content">
      {block.type==="heading"&&<Editable className="canvas-heading" value={block.title} placeholder="제목을 입력하세요" onChange={value=>set("title",value)}/>}
      {block.type==="text"&&<><Editable className="canvas-subheading" value={block.title} placeholder="소제목 추가" onChange={value=>set("title",value)}/><Editable className="canvas-body" value={block.body} placeholder="본문을 바로 입력하세요" onChange={value=>set("body",value)}/></>}
      {block.type==="card"&&<><Editable className="canvas-subheading" value={block.title} placeholder="박스 제목" onChange={value=>set("title",value)}/><Editable className="canvas-body" value={block.body} placeholder="박스 내용을 바로 입력하세요" onChange={value=>set("body",value)}/></>}
      {block.type==="image"&&(block.imageUrl?<img src={block.imageUrl} alt={block.alt||"이벤트 이미지"}/>:<div className="event-canvas-placeholder"><ImageIcon/><b>이미지 박스</b><span>선택 후 오른쪽에서 URL을 붙여 넣으세요.</span></div>)}
      {block.type==="video"&&<div className="event-canvas-placeholder"><Video/><b>{block.videoUrl?"영상이 연결되었습니다":"영상 박스"}</b><span>{block.videoUrl||"선택 후 오른쪽에서 URL을 붙여 넣으세요."}</span></div>}
      {block.type==="button"&&<span className={`canvas-button ${block.buttonStyle||"primary"}`}><Editable className="canvas-button-label" value={block.label} placeholder="버튼 이름" onChange={value=>set("label",value)}/><Link2/></span>}
      {block.type==="countdown"&&<div className="canvas-countdown"><span>D-DAY</span><b>00</b><small>일</small><b>00</b><small>시간</small><b>00</b><small>분</small></div>}
      {block.type==="schedule"&&<div className="canvas-schedule"><CalendarClock/><div><b>이벤트 일정표</b><span>등록한 일정이 이 자리에 표시됩니다.</span></div></div>}
      {block.type==="divider"&&<hr/>}{block.type==="spacer"&&<span className="canvas-spacer-label">여백</span>}
    </div>
  </article>;
}

function Inspector({block,onChange}:{block:EventPageBlock;onChange:(next:EventPageBlock)=>void}){
  const set=(key:keyof EventPageBlock,value:string)=>onChange({...block,[key]:value});
  return <aside className="event-canvas-inspector"><header><Palette/><div><small>선택한 요소</small><b>{blockLabel(block.type)} 꾸미기</b></div></header>
    <label>종류<select value={block.type} onChange={event=>onChange({...freshBlock(event.target.value as EventPageBlock["type"],block.width),id:block.id})}>{BLOCKS.map(item=><option key={item.type} value={item.type}>{item.label}</option>)}</select></label>
    {block.type==="image"&&<><label>이미지 URL<input value={block.imageUrl||""} onChange={event=>set("imageUrl",event.target.value)} placeholder="https://..."/></label><label>이미지 설명<input value={block.alt||""} onChange={event=>set("alt",event.target.value)}/></label></>}
    {block.type==="video"&&<label>영상 URL<input value={block.videoUrl||""} onChange={event=>set("videoUrl",event.target.value)} placeholder="YouTube 또는 영상 주소"/></label>}
    {block.type==="button"&&<><label>이동 링크<input value={block.url||""} onChange={event=>set("url",event.target.value)} placeholder="/events 또는 https://..."/></label><label>버튼 모양<select value={block.buttonStyle||"primary"} onChange={event=>set("buttonStyle",event.target.value)}><option value="primary">채운 버튼</option><option value="outline">외곽선 버튼</option></select></label></>}
    {block.type==="countdown"&&<label>기준 일시<input type="datetime-local" value={block.targetAt||""} onChange={event=>set("targetAt",event.target.value)}/><small>비우면 페이지의 D-Day 일시를 사용합니다.</small></label>}
    {!['divider','spacer','image','video'].includes(block.type)&&<div className="inspector-colors"><label>배경<input type="color" value={block.backgroundColor||"#fffaf5"} onChange={event=>set("backgroundColor",event.target.value)}/></label><label>글자<input type="color" value={block.textColor||"#3e2824"} onChange={event=>set("textColor",event.target.value)}/></label></div>}
    {!['divider','spacer'].includes(block.type)&&<label>내용 정렬<div className="inspector-segments">{["left","center","right"].map(value=><button key={value} type="button" className={(block.alignment||"left")===value?"active":""} onClick={()=>set("alignment",value)}>{value==="left"?"왼쪽":value==="center"?"가운데":"오른쪽"}</button>)}</div></label>}
    <label>안쪽 여백<div className="inspector-segments">{[["compact","좁게"],["normal","보통"],["roomy","넓게"]].map(([value,label])=><button key={value} type="button" className={(block.padding||"normal")===value?"active":""} onClick={()=>set("padding",value)}>{label}</button>)}</div></label>
  </aside>;
}

export function EventPageBuilder({source="contentBlocks"}:{source?:string}){
  const {field}=useInput({source});const {watch}=useFormContext();const [selectedId,setSelectedId]=useState<string|null>(null);
  const raw=Array.isArray(field.value)?field.value:[];
  const blocks:EventPageBlock[]=raw.map((item:Partial<EventPageBlock>,index:number)=>({...item,id:item.id||`block-${index}`} as EventPageBlock));
  const change=(next:EventPageBlock[])=>field.onChange(next);
  const add=(type:EventPageBlock["type"],width:EventPageBlock["width"]="full")=>{const block=freshBlock(type,width);change([...blocks,block]);setSelectedId(block.id);};
  const addColumns=(count:2|3)=>{const width=count===2?"half":"third";const additions=Array.from({length:count},(_,index)=>({...freshBlock("card",width),title:`${index+1}번째 박스`}));change([...blocks,...additions]);setSelectedId(additions[0].id);};
  const starter=()=>{const next=[{...freshBlock("heading"),title:String(watch("title")||"이벤트 안내")},{...freshBlock("text"),title:"이벤트 소개",body:String(watch("summary")||"이벤트의 자세한 내용을 입력하세요.")},freshBlock("countdown"),freshBlock("button"),freshBlock("schedule")];change(next);setSelectedId(next[0].id);};
  const update=(id:string,next:EventPageBlock)=>change(blocks.map(item=>item.id===id?next:item));
  const selected=blocks.find(item=>item.id===selectedId)||null;
  return <section className="event-page-builder event-page-canvas-editor">
    <header><div><small>VISUAL PAGE EDITOR</small><h2>페이지를 보면서 바로 편집</h2><p>요소를 누르면 바로 수정할 수 있습니다. 2열·3열을 누르면 박스가 나란히 추가됩니다.</p></div><button type="button" onClick={starter}>추천 페이지 만들기</button></header>
    <div className="event-canvas-toolbar"><div>{BLOCKS.filter(item=>!["divider","spacer"].includes(item.type)).map(item=>{const Icon=item.icon;return <button key={item.type} type="button" onClick={()=>add(item.type)}><Icon/>{item.label}</button>})}</div><div className="layout-tools"><button type="button" onClick={()=>addColumns(2)}><Columns2/>2열 박스</button><button type="button" onClick={()=>addColumns(3)}><Columns3/>3열 박스</button><button type="button" onClick={()=>add("divider")}><Minus/>구분선</button><button type="button" onClick={()=>add("spacer")}><Space/>여백</button></div></div>
    <div className="event-canvas-workspace">
      <div className="event-visual-canvas" onClick={()=>setSelectedId(null)}><div className="event-canvas-browser-bar"><i/><i/><i/><span>이벤트 페이지 미리보기</span></div><div className="event-canvas-page"><DragDropProvider onDragEnd={event=>change(move(blocks,event) as EventPageBlock[])}>{blocks.map((block,index)=><CanvasBlock key={block.id} block={block} index={index} selected={selectedId===block.id} onSelect={()=>setSelectedId(block.id)} onChange={next=>update(block.id,next)} onRemove={()=>{change(blocks.filter(item=>item.id!==block.id));setSelectedId(null);}} onDuplicate={()=>{const copy={...block,id:crypto.randomUUID()};change([...blocks.slice(0,index+1),copy,...blocks.slice(index+1)]);setSelectedId(copy.id);}} onInsert={()=>{const inserted=freshBlock("text");change([...blocks.slice(0,index+1),inserted,...blocks.slice(index+1)]);setSelectedId(inserted.id);}}/>)}</DragDropProvider>{!blocks.length&&<button className="event-canvas-empty" type="button" onClick={event=>{event.stopPropagation();starter();}}><Plus/><b>첫 요소 추가하기</b><span>추천 구성을 만들거나 위 도구에서 원하는 요소를 누르세요.</span></button>}<button className="event-canvas-bottom-add" type="button" onClick={event=>{event.stopPropagation();add("text");}}><Plus/>아래에 섹션 추가</button></div></div>
      {selected?<Inspector block={selected} onChange={next=>update(selected.id,next)}/>:<aside className="event-canvas-inspector empty"><Square/><b>페이지 요소를 선택하세요</b><p>선택한 박스의 링크, 색상, 정렬을 여기서 바꿀 수 있습니다.</p></aside>}
    </div>
  </section>;
}
