"use client";

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

function asDataUrl(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(reader.error||new Error("이미지를 읽지 못했습니다."));reader.readAsDataURL(file);});}

export async function uploadEditorImage(file:File){
  if(!functions)throw new Error("Firebase Functions가 연결되지 않았습니다.");
  if(!file.type.startsWith("image/"))throw new Error("이미지 파일만 업로드할 수 있습니다.");
  if(file.size>8*1024*1024)throw new Error("이미지는 8MB 이하로 업로드해 주세요.");
  const call=httpsCallable<{image:string;name:string},{url:string}>(functions,"uploadEditorImage");
  const result=await call({image:await asDataUrl(file),name:file.name});
  return result.data.url;
}
