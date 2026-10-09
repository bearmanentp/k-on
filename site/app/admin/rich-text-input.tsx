"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useInput } from "react-admin";

export function RichTextInput({label="본문"}:{label?:string}){
  const rich=useInput({source:"bodyRich"});
  const plain=useInput({source:"body"});
  const editor=useEditor({
    extensions:[StarterKit],
    content:rich.field.value||plain.field.value||"",
    immediatelyRender:false,
    onUpdate:({editor:next})=>{rich.field.onChange(next.getJSON());plain.field.onChange(next.getText());},
  });
  if(!editor)return null;
  return <div className="tiptap-field"><label>{label}</label><div className="tiptap-toolbar"><button type="button" className={editor.isActive("bold")?"active":""} onClick={()=>editor.chain().focus().toggleBold().run()}>굵게</button><button type="button" className={editor.isActive("italic")?"active":""} onClick={()=>editor.chain().focus().toggleItalic().run()}>기울임</button><button type="button" className={editor.isActive("strike")?"active":""} onClick={()=>editor.chain().focus().toggleStrike().run()}>취소선</button><button type="button" className={editor.isActive("heading",{level:2})?"active":""} onClick={()=>editor.chain().focus().toggleHeading({level:2}).run()}>제목</button><button type="button" className={editor.isActive("bulletList")?"active":""} onClick={()=>editor.chain().focus().toggleBulletList().run()}>글머리표</button><button type="button" className={editor.isActive("orderedList")?"active":""} onClick={()=>editor.chain().focus().toggleOrderedList().run()}>번호 목록</button><button type="button" className={editor.isActive("blockquote")?"active":""} onClick={()=>editor.chain().focus().toggleBlockquote().run()}>인용</button><button type="button" onClick={()=>editor.chain().focus().undo().run()}>실행 취소</button><button type="button" onClick={()=>editor.chain().focus().redo().run()}>다시 실행</button></div><EditorContent editor={editor}/></div>;
}
