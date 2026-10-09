"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot } from "firebase/firestore";
import { useInput, useNotify } from "react-admin";
import { Armchair, Download, Grid3X3, Save, Upload } from "lucide-react";
import { db } from "@/lib/firebase";

export type SeatCell={id:string;label:string;row:number;column:number;kind:"seat"|"blocked"|"aisle"};
export type SeatLayout={version:1;name?:string;stageLabel:string;rows:number;columns:number;cells:SeatCell[]};
type Template={id:string;name:string;layout:SeatLayout};

function makeLayout(rows:number,columns:number,current?:SeatLayout):SeatLayout{
  const previous=new Map((current?.cells||[]).map(cell=>[`${cell.row}:${cell.column}`,cell]));
  const cells=Array.from({length:rows*columns},(_,index)=>{const row=Math.floor(index/columns),column=index%columns,key=`${row}:${column}`,saved=previous.get(key);return saved||{id:`seat-${row}-${column}`,label:`${String.fromCharCode(65+row)}${column+1}`,row,column,kind:"seat" as const};});
  return{version:1,stageLabel:current?.stageLabel||"STAGE",rows,columns,cells};
}
function normalizeLayout(value:unknown):SeatLayout{
  const layout=value&&typeof value==="object"?value as Partial<SeatLayout>:{};
  const rows=Math.min(26,Math.max(1,Number(layout.rows||6))),columns=Math.min(30,Math.max(1,Number(layout.columns||10)));
  return makeLayout(rows,columns,{version:1,stageLabel:String(layout.stageLabel||"STAGE"),rows,columns,cells:Array.isArray(layout.cells)?layout.cells:[]} as SeatLayout);
}

export function SeatLayoutInput({source="seatLayout"}:{source?:string}){
  const {field}=useInput({source});
  const notify=useNotify();
  const layout=useMemo(()=>normalizeLayout(field.value),[field.value]);
  const [rows,setRows]=useState(layout.rows),[columns,setColumns]=useState(layout.columns),[templateName,setTemplateName]=useState(""),[selectedTemplate,setSelectedTemplate]=useState(""),[templates,setTemplates]=useState<Template[]>([]),[jsonText,setJsonText]=useState("");
  useEffect(()=>{setRows(layout.rows);setColumns(layout.columns);},[layout.rows,layout.columns]);
  useEffect(()=>{if(!field.value)field.onChange(layout);},[field,layout]);
  useEffect(()=>{if(!db)return;return onSnapshot(collection(db,"seatLayouts"),snapshot=>setTemplates(snapshot.docs.map(item=>({id:item.id,...item.data()} as Template)).sort((a,b)=>a.name.localeCompare(b.name))));},[]);
  function update(next:SeatLayout){field.onChange(next);setJsonText(JSON.stringify(next,null,2));}
  function cycle(cell:SeatCell){const nextKind=cell.kind==="seat"?"blocked":cell.kind==="blocked"?"aisle":"seat";update({...layout,cells:layout.cells.map(item=>item.id===cell.id?{...item,kind:nextKind}:item)});}
  async function saveTemplate(){if(!db||!templateName.trim())return notify("템플릿 이름을 입력해 주세요.",{type:"warning"});await addDoc(collection(db,"seatLayouts"),{name:templateName.trim(),layout,createdAt:new Date().toISOString()});setTemplateName("");notify("좌석 배치 템플릿을 저장했습니다.",{type:"success"});}
  function loadTemplate(){const template=templates.find(item=>item.id===selectedTemplate);if(!template)return notify("불러올 템플릿을 선택해 주세요.",{type:"warning"});update(normalizeLayout(template.layout));notify("좌석 배치를 불러왔습니다.",{type:"success"});}
  function applyJson(){try{update(normalizeLayout(JSON.parse(jsonText)));notify("JSON 배치 데이터를 적용했습니다.",{type:"success"});}catch{notify("좌석 배치 JSON 형식을 확인해 주세요.",{type:"warning"});}}
  function downloadJson(){const blob=new Blob([JSON.stringify(layout,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=`seat-layout-${Date.now()}.json`;anchor.click();URL.revokeObjectURL(url);}
  return <section className="seat-layout-builder"><div className="seat-layout-heading"><span><Armchair/></span><div><b>좌석 배치도</b><small>좌석을 누르면 일반 좌석 → 사용 불가 → 통로 순서로 변경됩니다.</small></div></div><div className="seat-layout-controls"><label>행<input type="number" min="1" max="26" value={rows} onChange={event=>setRows(Number(event.target.value))}/></label><label>열<input type="number" min="1" max="30" value={columns} onChange={event=>setColumns(Number(event.target.value))}/></label><label>무대 이름<input value={layout.stageLabel} onChange={event=>update({...layout,stageLabel:event.target.value})}/></label><button type="button" onClick={()=>update(makeLayout(rows,columns,layout))}><Grid3X3/>배치 생성</button></div><div className="seat-layout-canvas" style={{gridTemplateColumns:`repeat(${layout.columns},34px)`}}><div className="seat-layout-stage" style={{gridColumn:`1 / span ${layout.columns}`}}>{layout.stageLabel}</div>{[...layout.cells].sort((a,b)=>a.row-b.row||a.column-b.column).map(cell=><button type="button" key={cell.id} className={cell.kind} onClick={()=>cycle(cell)} title={`${cell.label} · ${cell.kind}`}>{cell.kind==="aisle"?"":cell.label}</button>)}</div><div className="seat-layout-legend"><span><i className="seat"/>좌석</span><span><i className="blocked"/>사용 불가</span><span><i className="aisle"/>통로</span></div><div className="seat-template-tools"><input value={templateName} onChange={event=>setTemplateName(event.target.value)} placeholder="템플릿 이름"/><button type="button" onClick={saveTemplate}><Save/>템플릿 저장</button><select value={selectedTemplate} onChange={event=>setSelectedTemplate(event.target.value)}><option value="">저장된 배치 선택</option>{templates.map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select><button type="button" onClick={loadTemplate}><Upload/>불러오기</button></div><details className="seat-layout-data"><summary>배치 JSON 가져오기·내보내기</summary><textarea rows={8} value={jsonText||JSON.stringify(layout,null,2)} onChange={event=>setJsonText(event.target.value)}/><div><button type="button" onClick={applyJson}><Upload/>JSON 적용</button><button type="button" onClick={downloadJson}><Download/>파일 저장</button></div></details>{field.value?null:<button type="button" className="seat-layout-initialize" onClick={()=>update(layout)}>현재 배치를 행사에 적용</button>}</section>;
}
