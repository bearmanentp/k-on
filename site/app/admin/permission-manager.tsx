"use client";

import { FormEvent, useState } from "react";
import { usePermissions } from "react-admin";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const permissionOptions=[
  ["notices","게시판","공지와 소식 관리"],
  ["design","디자인","로고·히어로·캐릭터 관리"],
  ["events","행사","행사와 신청폼 관리"],
  ["applications","문의·예약","문의 답변과 예약 처리"],
  ["users","내부 공지","권한별 관리자 공지 작성"],
  ["shopManagers","상점 담당","지정된 상점의 상품 등록·수정·삭제"],
  ["points","포인트","회원 포인트 지급과 이력 관리"],
];

export function PermissionManager(){
  const {permissions}=usePermissions();
  const [message,setMessage]=useState("");
  if(!Array.isArray(permissions)||(!permissions.includes("owner")&&!permissions.includes("deputy")))return null;
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!db||!auth?.currentUser)return setMessage("Firebase 연결이 필요합니다.");const form=new FormData(e.currentTarget),email=String(form.get("email")||"").trim().toLowerCase(),role=String(form.get("role")||"manager"),selected=form.getAll("permissions").map(String);try{const target=doc(db,"adminDirectory",email);if(selected.length){await setDoc(target,{email,role,permissions:selected,active:true,updatedAt:new Date().toISOString(),updatedBy:auth.currentUser.uid});setMessage("관리자 권한을 저장했습니다. 해당 계정은 다시 로그인하면 적용됩니다.");}else{await deleteDoc(target);setMessage("관리자 권한을 해제했습니다.");}}catch(error){setMessage(error instanceof Error?error.message:"권한 저장에 실패했습니다.");}}
  return <section className="permission-system"><div><small>OWNER ACCESS</small><h2>관리자 추가·권한 변경</h2><p>먼저 회원가입한 계정의 이메일을 입력하세요. 부총관리자는 총관리자 권한을 변경할 수 없고, 그 외 운영 권한을 관리할 수 있습니다.</p></div><form onSubmit={submit}><input name="email" type="email" placeholder="manager@example.com" required/><select name="role" defaultValue="manager"><option value="manager">담당 관리자</option><option value="deputy">부총관리자</option></select><div>{permissionOptions.map(([value,label,description])=><label key={value}><input name="permissions" value={value} type="checkbox" defaultChecked={value==="notices"}/><span><b>{label}</b><small>{description}</small></span></label>)}</div><button>관리자 권한 저장</button>{message&&<p className="permission-result">{message}</p>}</form></section>;
}
