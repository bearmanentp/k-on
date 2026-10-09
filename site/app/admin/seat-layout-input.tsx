"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, onSnapshot } from "firebase/firestore";
import { useInput, useNotify } from "react-admin";
import { Armchair, Download, Grid3X3, RotateCcw, RotateCw, Save, Upload } from "lucide-react";
import { db } from "@/lib/firebase";

export type SeatCell={id:string;label:string;row:number;column:number;kind:"seat"|"blocked"|"aisle";x:number;y:number;rotation:number};
type Stage={x:number;y:number;width:number;height:number;rotation:number};
export type SeatLayout={version:2;name?:string;stageLabel:string;rows:number;columns:number;canvasWidth:number;canvasHeight:number;stage:Stage;cells:SeatCell[]};
type Template={id:string;name:string;layout:SeatLayout};
type Selection={type:"seat";id:string}|{type:"stage"};
type DragState={pointerId:number;selection:Selection;startX:number;startY:number;originX:number;originY:number};

const CELL_SIZE=36;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

function makeLayout(rows:number,columns:number,current?:SeatLayout):SeatLayout{
  const canvasWidth=Math.max(Number(current?.canvasWidth||0),Math.max(520,columns*44+100));
  const canvasHeight=Math.max(Number(current?.canvasHeight||0),Math.max(360,rows*44+170));
  const previous=new Map((current?.cells||[]).map(cell=>[`${cell.row}:${cell.column}`,cell]));
  const cells=Array.from({length:rows*columns},(_,index)=>{
    const row=Math.floor(index/columns),column=index%columns,key=`${row}:${column}`,saved=previous.get(key);
    return{id:saved?.id||`seat-${row}-${column}`,label:saved?.label||`${String.fromCharCode(65+row)}${column+1}`,row,column,kind:saved?.kind||"seat",x:Number.isFinite(saved?.x)?saved!.x:50+column*44,y:Number.isFinite(saved?.y)?saved!.y:105+row*44,rotation:Number(saved?.rotation||0)} as SeatCell;
  });
  const defaultStage={x:60,y:24,width:Math.min(canvasWidth-120,Math.max(280,columns*44)),height:42,rotation:0};
  return{version:2,stageLabel:current?.stageLabel||"STAGE",rows,columns,canvasWidth,canvasHeight,stage:{...defaultStage,...current?.stage},cells};
}
function normalizeLayout(value:unknown):SeatLayout{
  const raw=value&&typeof value==="object"?value as Partial<SeatLayout>:{},rows=Math.min(26,Math.max(1,Number(raw.rows||6))),columns=Math.min(30,Math.max(1,Number(raw.columns||10)));
  const legacyCells=Array.isArray(raw.cells)?raw.cells.map((cell,index)=>{const item=cell as Partial<SeatCell>;const row=Number(item.row??Math.floor(index/columns)),column=Number(item.column??index%columns);return{...item,row,column,x:Number.isFinite(item.x)?Number(item.x):50+column*44,y:Number.isFinite(item.y)?Number(item.y):105+row*44,rotation:Number(item.rotation||0)} as SeatCell;}):[];
  return makeLayout(rows,columns,{...raw,version:2,stageLabel:String(raw.stageLabel||"STAGE"),rows,columns,cells:legacyCells} as SeatLayout);
}

export function SeatLayoutInput({source="seatLayout"}:{source?:string}){
  const {field}=useInput({source}),notify=useNotify(),layout=useMemo(()=>normalizeLayout(field.value),[field.value]);
  const [rows,setRows]=useState(layout.rows),[columns,setColumns]=useState(layout.columns),[templateName,setTemplateName]=useState(""),[selectedTemplate,setSelectedTemplate]=useState(""),[templates,setTemplates]=useState<Template[]>([]),[jsonText,setJsonText]=useState(""),[selection,setSelection]=useState<Selection|null>(null);
  const drag=useRef<DragState|null>(null);
  useEffect(()=>{setRows(layout.rows);setColumns(layout.columns);},[layout.rows,layout.columns]);
  useEffect(()=>{if(!field.value)field.onChange(layout);},[field,layout]);
  useEffect(()=>{if(!db)return;return onSnapshot(collection(db,"seatLayouts"),snapshot=>setTemplates(snapshot.docs.map(item=>({id:item.id,...item.data()} as Template)).sort((a,b)=>a.name.localeCompare(b.name))));},[]);
  function update(next:SeatLayout){field.onChange(next);setJsonText(JSON.stringify(next,null,2));}
  function patchSeat(id:string,patch:Partial<SeatCell>){update({...layout,cells:layout.cells.map(cell=>cell.id===id?{...cell,...patch}:cell)});}
  function patchSelection(patch:{rotation?:number;kind?:SeatCell["kind"]}){if(!selection)return;if(selection.type==="stage")update({...layout,stage:{...layout.stage,rotation:Number(patch.rotation??layout.stage.rotation)}});else patchSeat(selection.id,patch);}
  function startDrag(event:PointerEvent<HTMLElement>,nextSelection:Selection,x:number,y:number){event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);setSelection(nextSelection);drag.current={pointerId:event.pointerId,selection:nextSelection,startX:event.clientX,startY:event.clientY,originX:x,originY:y};}
  function moveDrag(event:PointerEvent<HTMLElement>){const state=drag.current;if(!state||state.pointerId!==event.pointerId)return;const x=state.originX+event.clientX-state.startX,y=state.originY+event.clientY-state.startY;if(state.selection.type==="stage")update({...layout,stage:{...layout.stage,x:clamp(x,0,layout.canvasWidth-layout.stage.width),y:clamp(y,0,layout.canvasHeight-layout.stage.height)}});else patchSeat(state.selection.id,{x:clamp(x,0,layout.canvasWidth-CELL_SIZE),y:clamp(y,0,layout.canvasHeight-CELL_SIZE)});}
  function endDrag(event:PointerEvent<HTMLElement>){if(drag.current?.pointerId===event.pointerId)drag.current=null;}
  async function saveTemplate(){if(!db||!templateName.trim())return notify("템플릿 이름을 입력해 주세요.",{type:"warning"});await addDoc(collection(db,"seatLayouts"),{name:templateName.trim(),layout,createdAt:new Date().toISOString()});setTemplateName("");notify("좌석 배치 템플릿을 저장했습니다.",{type:"success"});}
  function loadTemplate(){const template=templates.find(item=>item.id===selectedTemplate);if(!template)return notify("불러올 템플릿을 선택해 주세요.",{type:"warning"});update(normalizeLayout(template.layout));setSelection(null);notify("좌석 배치를 불러왔습니다.",{type:"success"});}
  function applyJson(){try{update(normalizeLayout(JSON.parse(jsonText)));setSelection(null);notify("JSON 배치 데이터를 적용했습니다.",{type:"success"});}catch{notify("좌석 배치 JSON 형식을 확인해 주세요.",{type:"warning"});}}
  function downloadJson(){const blob=new Blob([JSON.stringify(layout,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=`seat-layout-${Date.now()}.json`;anchor.click();URL.revokeObjectURL(url);}
  const selectedCell=selection?.type==="seat"?layout.cells.find(cell=>cell.id===selection.id):undefined,currentRotation=selection?.type==="stage"?layout.stage.rotation:selectedCell?.rotation||0;
  return <section className="seat-layout-builder">
    <div className="seat-layout-heading"><span><Armchair/></span><div><b>자유 좌석 배치도</b><small>좌석과 무대를 마우스로 끌어 배치하고, 선택한 요소를 회전할 수 있습니다.</small></div></div>
    <div className="seat-layout-controls"><label>행<input type="number" min="1" max="26" value={rows} onChange={event=>setRows(Number(event.target.value))}/></label><label>열<input type="number" min="1" max="30" value={columns} onChange={event=>setColumns(Number(event.target.value))}/></label><label>도면 너비<input type="number" min="320" max="1800" value={layout.canvasWidth} onChange={event=>update({...layout,canvasWidth:Number(event.target.value)})}/></label><label>도면 높이<input type="number" min="260" max="1400" value={layout.canvasHeight} onChange={event=>update({...layout,canvasHeight:Number(event.target.value)})}/></label><label>무대 이름<input value={layout.stageLabel} onChange={event=>update({...layout,stageLabel:event.target.value})}/></label><button type="button" onClick={()=>{update(makeLayout(rows,columns,layout));setSelection(null);}}><Grid3X3/>격자 좌석 추가·정리</button></div>
    <div className="seat-layout-selection"><b>{selection?.type==="stage"?"무대 선택됨":selectedCell?`${selectedCell.label} 선택됨`:"좌석이나 무대를 선택하세요"}</b>{selectedCell&&<><button type="button" className={selectedCell.kind==="seat"?"active":""} onClick={()=>patchSelection({kind:"seat"})}>일반 좌석</button><button type="button" className={selectedCell.kind==="blocked"?"active":""} onClick={()=>patchSelection({kind:"blocked"})}>사용 불가</button><button type="button" className={selectedCell.kind==="aisle"?"active":""} onClick={()=>patchSelection({kind:"aisle"})}>통로</button></>} {selection&&<><button type="button" onClick={()=>patchSelection({rotation:currentRotation-15})}><RotateCcw/>-15°</button><label>회전<input type="number" min="-360" max="360" value={currentRotation} onChange={event=>patchSelection({rotation:Number(event.target.value)})}/></label><button type="button" onClick={()=>patchSelection({rotation:currentRotation+15})}><RotateCw/>+15°</button></>}</div>
    <div className="seat-layout-scroll"><div className="seat-layout-canvas freeform" style={{width:layout.canvasWidth,height:layout.canvasHeight}} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <button type="button" className={`seat-layout-stage ${selection?.type==="stage"?"selected":""}`} style={{left:layout.stage.x,top:layout.stage.y,width:layout.stage.width,height:layout.stage.height,transform:`rotate(${layout.stage.rotation}deg)`}} onPointerDown={event=>startDrag(event,{type:"stage"},layout.stage.x,layout.stage.y)}>{layout.stageLabel}</button>
      {layout.cells.map(cell=><button type="button" key={cell.id} className={`${cell.kind} ${selection?.type==="seat"&&selection.id===cell.id?"selected":""}`} style={{left:cell.x,top:cell.y,transform:`rotate(${cell.rotation}deg)`}} onPointerDown={event=>startDrag(event,{type:"seat",id:cell.id},cell.x,cell.y)} title={`${cell.label} · ${cell.kind} · ${cell.rotation}°`}>{cell.kind==="aisle"?"":cell.label}</button>)}
    </div></div>
    <div className="seat-layout-legend"><span><i className="seat"/>좌석</span><span><i className="blocked"/>사용 불가</span><span><i className="aisle"/>통로</span><span>드래그: 이동 · 선택 후 회전</span></div>
    <div className="seat-template-tools"><input value={templateName} onChange={event=>setTemplateName(event.target.value)} placeholder="템플릿 이름"/><button type="button" onClick={saveTemplate}><Save/>템플릿 저장</button><select value={selectedTemplate} onChange={event=>setSelectedTemplate(event.target.value)}><option value="">저장된 배치 선택</option>{templates.map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select><button type="button" onClick={loadTemplate}><Upload/>불러오기</button></div>
    <details className="seat-layout-data"><summary>배치 JSON 가져오기·내보내기</summary><textarea rows={8} value={jsonText||JSON.stringify(layout,null,2)} onChange={event=>setJsonText(event.target.value)}/><div><button type="button" onClick={applyJson}><Upload/>JSON 적용</button><button type="button" onClick={downloadJson}><Download/>파일 저장</button></div></details>
  </section>;
}
