"use client";

import { useMemo } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move as moveItems } from "@dnd-kit/helpers";
import { JsonForms } from "@jsonforms/react";
import { vanillaCells, vanillaRenderers } from "@jsonforms/vanilla-renderers";
import { addDoc, collection } from "firebase/firestore";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useCanAccess, useNotify } from "react-admin";
import { db } from "@/lib/firebase";

const fieldSchema=z.object({id:z.string(),label:z.string().min(1,"질문을 입력하세요."),type:z.enum(["text","email","tel","textarea","select","radio","checkbox"]),required:z.boolean(),optionsText:z.string()});
const builderSchema=z.object({title:z.string().min(1),date:z.string().min(1),place:z.string().min(1),capacity:z.coerce.number().min(1),summary:z.string().min(1),fields:z.array(fieldSchema).min(1)});
type BuilderValues=z.infer<typeof builderSchema>;

function SortableQuestion({item,index,register,remove}:{item:{id:string};index:number;register:ReturnType<typeof useForm<BuilderValues>>["register"];remove:(index:number)=>void}){
  const {ref,handleRef,isDragging}=useSortable({id:item.id,index});
  return <div ref={ref} className={`builder-question ${isDragging?"dragging":""}`}><button ref={handleRef} type="button" className="drag-handle" aria-label="질문 순서 이동"><GripVertical/></button><input {...register(`fields.${index}.label`)} placeholder="질문 내용"/><select {...register(`fields.${index}.type`)}><option value="text">짧은 답변</option><option value="email">이메일</option><option value="tel">전화번호</option><option value="textarea">긴 답변</option><option value="select">선택 목록</option><option value="radio">단일 선택</option><option value="checkbox">동의 확인</option></select><input {...register(`fields.${index}.optionsText`)} placeholder="선택지: 쉼표로 구분"/><label className="builder-required"><input type="checkbox" {...register(`fields.${index}.required`)}/>필수</label><button type="button" className="remove-question" onClick={()=>remove(index)} aria-label="질문 삭제"><Trash2/></button></div>;
}

export function EventFormBuilder(){
  const notify=useNotify();
  const {canAccess}=useCanAccess({resource:"events",action:"create"});
  const form=useForm<BuilderValues>({resolver:zodResolver(builderSchema),defaultValues:{title:"",date:"",place:"",capacity:20,summary:"",fields:[{id:crypto.randomUUID(),label:"닉네임",type:"text",required:true,optionsText:""}]}});
  const {fields,append,remove,replace}=useFieldArray({control:form.control,name:"fields",keyName:"formKey"});
  const observed=useWatch({control:form.control,name:"fields"});
  const watched=useMemo(()=>observed||[],[observed]);
  const jsonSchema=useMemo(()=>({type:"object",properties:Object.fromEntries(watched.map(field=>[field.id,{type:field.type==="checkbox"?"boolean":"string",title:field.label,...(["select","radio"].includes(field.type)&&field.optionsText?{enum:field.optionsText.split(",").map(value=>value.trim()).filter(Boolean)}:{})}])),required:watched.filter(field=>field.required).map(field=>field.id)}),[watched]);
  const uiSchema=useMemo(()=>({type:"VerticalLayout",elements:watched.map(field=>({type:"Control",scope:`#/properties/${field.id}`,options:field.type==="radio"?{format:"radio"}:undefined}))}),[watched]);
  if(!canAccess)return null;
  const submit=form.handleSubmit(async values=>{if(!db)return notify("Firebase 연결이 필요합니다.",{type:"warning"});await addDoc(collection(db,"events"),{title:values.title,date:values.date,place:values.place,capacity:values.capacity,summary:values.summary,status:"open",createdAt:new Date().toISOString(),formSchema:values.fields.map(field=>({id:field.id,label:field.label,type:field.type,required:field.required,options:field.optionsText.split(",").map(value=>value.trim()).filter(Boolean)})),jsonSchema});notify("행사와 신청폼을 등록했습니다.",{type:"success"});form.reset();});
  return <section className="admin-builder"><div className="admin-builder-head"><div><small>FORM SYSTEM</small><h2>행사 신청폼 빌더</h2><p>질문을 추가하고 끌어서 순서를 바꾸면 실제 폼을 오른쪽에서 바로 확인할 수 있습니다.</p></div></div><div className="builder-layout"><form onSubmit={submit}><div className="builder-event-fields"><input {...form.register("title")} placeholder="행사명"/><input {...form.register("date")} type="datetime-local"/><input {...form.register("place")} placeholder="장소"/><input {...form.register("capacity")} type="number" min="1" placeholder="정원"/><textarea {...form.register("summary")} placeholder="행사 소개"/></div><DragDropProvider onDragEnd={event=>replace(moveItems(fields,event).map(field=>({id:String(field.id),label:field.label,type:field.type,required:field.required,optionsText:field.optionsText})))}>{fields.map((field,index)=><SortableQuestion key={field.formKey} item={field} index={index} register={form.register} remove={remove}/>)}</DragDropProvider><button type="button" className="add-question" onClick={()=>append({id:crypto.randomUUID(),label:"",type:"text",required:false,optionsText:""})}><Plus/>질문 추가</button><button className="save-builder" type="submit">행사·신청폼 저장</button></form><aside className="jsonforms-preview"><span>LIVE PREVIEW</span><JsonForms schema={jsonSchema} uischema={uiSchema} data={{}} renderers={vanillaRenderers} cells={vanillaCells}/></aside></div></section>;
}
