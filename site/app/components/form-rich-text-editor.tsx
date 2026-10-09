"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TiptapImage from "@tiptap/extension-image";

export function FormRichTextEditor({label="본문",name="body",richName="bodyRich",initialContent=""}:{label?:string;name?:string;richName?:string;initialContent?:unknown}){
  const root=useRef<HTMLDivElement>(null),[plain,setPlain]=useState(""),[rich,setRich]=useState("");
  const editor=useEditor({extensions:[StarterKit,Link.configure({openOnClick:false,autolink:true}),TiptapImage.configure({allowBase64:false})],content:initialContent||"",immediatelyRender:false,onUpdate:({editor:next})=>{setPlain(next.getText());setRich(JSON.stringify(next.getJSON()));}});
  useEffect(()=>{const form=root.current?.closest("form");if(!form||!editor)return;const reset=()=>{editor.commands.clearContent();setPlain("");setRich("");};form.addEventListener("reset",reset);return()=>form.removeEventListener("reset",reset);},[editor]);
  if(!editor)return null;
  const tool=(text:string,active:boolean,run:()=>void)=><button type="button" className={active?"active":""} onClick={run}>{text}</button>;
  const addLink=()=>{const url=window.prompt("링크 주소를 입력하세요",editor.getAttributes("link").href||"https://");if(url===null)return;if(url.trim())editor.chain().focus().setLink({href:url.trim(),target:"_blank"}).run();else editor.chain().focus().unsetLink().run();};
  const addImage=()=>{const url=window.prompt("본문에 넣을 이미지의 직접 URL을 입력하세요","https://");if(!url?.trim())return;const alt=window.prompt("이미지 설명을 입력하세요","")||"";editor.chain().focus().setImage({src:url.trim(),alt}).run();};
  return <div className="tiptap-field form-tiptap" ref={root}><label>{label}</label><div className="tiptap-toolbar">{tool("굵게",editor.isActive("bold"),()=>editor.chain().focus().toggleBold().run())}{tool("기울임",editor.isActive("italic"),()=>editor.chain().focus().toggleItalic().run())}{tool("취소선",editor.isActive("strike"),()=>editor.chain().focus().toggleStrike().run())}{tool("제목 2",editor.isActive("heading",{level:2}),()=>editor.chain().focus().toggleHeading({level:2}).run())}{tool("제목 3",editor.isActive("heading",{level:3}),()=>editor.chain().focus().toggleHeading({level:3}).run())}{tool("글머리표",editor.isActive("bulletList"),()=>editor.chain().focus().toggleBulletList().run())}{tool("번호 목록",editor.isActive("orderedList"),()=>editor.chain().focus().toggleOrderedList().run())}{tool("인용",editor.isActive("blockquote"),()=>editor.chain().focus().toggleBlockquote().run())}{tool("코드",editor.isActive("codeBlock"),()=>editor.chain().focus().toggleCodeBlock().run())}{tool("구분선",false,()=>editor.chain().focus().setHorizontalRule().run())}{tool("링크",editor.isActive("link"),addLink)}{tool("이미지 URL",false,addImage)}{tool("실행 취소",false,()=>editor.chain().focus().undo().run())}{tool("다시 실행",false,()=>editor.chain().focus().redo().run())}</div><EditorContent editor={editor}/><input type="hidden" name={name} value={plain}/><input type="hidden" name={richName} value={rich}/></div>;
}
