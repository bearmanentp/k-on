"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useInput } from "react-admin";

export function RichTextInput({label="본문"}:{label?:string}){
  const rich=useInput({source:"bodyRich"});
  const plain=useInput({source:"body"});
  const editor=useEditor({
    extensions:[StarterKit,Link.configure({openOnClick:false,autolink:true})],
    content:rich.field.value||plain.field.value||"",
    immediatelyRender:false,
    onUpdate:({editor:next})=>{rich.field.onChange(next.getJSON());plain.field.onChange(next.getText());},
  });
  if(!editor)return null;
  const addLink=()=>{const current=editor.getAttributes("link").href;const url=window.prompt("링크 주소를 입력하세요",current||"https://");if(url===null)return;if(!url.trim())editor.chain().focus().unsetLink().run();else editor.chain().focus().setLink({href:url.trim(),target:"_blank"}).run();};
  const tool=(name:string,active:boolean,onClick:()=>void)=><button type="button" className={active?"active":""} aria-label={name} onClick={onClick}>{name}</button>;
  return <div className="tiptap-field"><label>{label}</label><div className="tiptap-toolbar">{tool("굵게",editor.isActive("bold"),()=>editor.chain().focus().toggleBold().run())}{tool("기울임",editor.isActive("italic"),()=>editor.chain().focus().toggleItalic().run())}{tool("취소선",editor.isActive("strike"),()=>editor.chain().focus().toggleStrike().run())}{tool("제목 2",editor.isActive("heading",{level:2}),()=>editor.chain().focus().toggleHeading({level:2}).run())}{tool("제목 3",editor.isActive("heading",{level:3}),()=>editor.chain().focus().toggleHeading({level:3}).run())}{tool("글머리표",editor.isActive("bulletList"),()=>editor.chain().focus().toggleBulletList().run())}{tool("번호 목록",editor.isActive("orderedList"),()=>editor.chain().focus().toggleOrderedList().run())}{tool("인용",editor.isActive("blockquote"),()=>editor.chain().focus().toggleBlockquote().run())}{tool("코드",editor.isActive("codeBlock"),()=>editor.chain().focus().toggleCodeBlock().run())}{tool("구분선",false,()=>editor.chain().focus().setHorizontalRule().run())}{tool("링크",editor.isActive("link"),addLink)}{tool("실행 취소",false,()=>editor.chain().focus().undo().run())}{tool("다시 실행",false,()=>editor.chain().focus().redo().run())}</div><EditorContent editor={editor}/></div>;
}
