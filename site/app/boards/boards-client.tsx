"use client";

// Client-side board navigation keeps tabs and article history responsive.

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { ArrowLeft, CircleUserRound, Home, LogOut, MessageSquareText, Newspaper, PenLine } from "lucide-react";
import { auth, db, firebaseConfigured } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import TiptapImage from "@tiptap/extension-image";
import { BOARD_BY_KEY, BOARD_DEFINITIONS, type BoardDefinition, type BoardKey } from "@/lib/board-config";
import { authErrorMessage, loginWithEmail, loginWithGoogle, registerWithEmail } from "@/lib/auth";
import { PublicHeader } from "@/app/components/public-header";
import { FormRichTextEditor } from "@/app/components/form-rich-text-editor";
import { readAdminAccess } from "@/lib/admin-access";
import { awardNoticeRead } from "@/lib/points";

type BoardTab = BoardKey;
type Permission = "design" | "events" | "notices" | "applications" | "users" | "points";
type Post = { id:string; title:string; body:string; bodyRich?:unknown; prefix?:string; category:string; createdAt:string; pinned?:boolean; attachmentName?:string; attachmentUrl?:string; pollQuestion?:string; pollOptions?:string };
type Inquiry = { id:string; userId:string; userEmail:string; title:string; body:string; bodyRich?:unknown; category:string; createdAt:string; status:"waiting"|"answered"; answer?:string; answerRich?:unknown; attachmentName?:string; attachmentUrl?:string; private?:boolean };
type InquiryCategory = { id:string; label:string; description?:string; active?:boolean; order?:number };
type RouteState = { tab:BoardTab; itemId?:string; compose?:boolean };

const LOGO = "https://upload.wikimedia.org/wikipedia/commons/1/17/K-ON_anime_wordmark.svg";
const DEFAULT_INQUIRY_CATEGORIES:InquiryCategory[] = [{id:"event",label:"행사"},{id:"reservation",label:"예약"},{id:"site",label:"사이트 이용"},{id:"etc",label:"기타"}];

function readRoute():RouteState {
  if(typeof window==="undefined")return{tab:"news"};
  const [rawTab,rawItem]=window.location.hash.replace(/^#/,"").split("/");
  const tab:BoardTab=rawTab||"news";
  return {tab,itemId:rawItem&&rawItem!=="new"?decodeURIComponent(rawItem):undefined,compose:tab==="inquiries"&&rawItem==="new"};
}
function formatDate(value:string){return new Date(value).toLocaleDateString("ko-KR");}
function richBody(body:string,bodyRich?:unknown){if(!bodyRich||typeof bodyRich!=="object")return <p>{body}</p>;try{return <div dangerouslySetInnerHTML={{__html:generateHTML(bodyRich as Parameters<typeof generateHTML>[0],[StarterKit,TiptapLink,TiptapImage])}}/>;}catch{return <p>{body}</p>;}}
function postBody(post:Post){return richBody(post.body,post.bodyRich);}
function directFileUrl(value:string){const match=value.match(/drive\.google\.com\/file\/d\/([^/]+)/)||value.match(/[?&]id=([^&]+)/);return match?`https://drive.google.com/uc?export=download&id=${match[1]}`:value;}
function PollBox({post}:{post:Post}){const options=(post.pollOptions||"").split(",").map(v=>v.trim()).filter(Boolean);if(!post.pollQuestion||options.length<2)return null;return <div className="poll-box"><b>{post.pollQuestion}</b>{options.map(option=><button type="button" key={option} onClick={async()=>{if(!auth?.currentUser||!db)return window.alert("투표하려면 로그인해 주세요.");await addDoc(collection(db,"pollVotes"),{postId:post.id,option,userId:auth.currentUser.uid,createdAt:new Date().toISOString()});window.alert("투표가 저장되었습니다.");}}>{option}</button>)}</div>}

export default function BoardsPage(){
  const [route,setRoute]=useState<RouteState>({tab:"news"});
  const [news,setNews]=useState<Post[]>([]),[notices,setNotices]=useState<Post[]>([]),[extraBoards,setExtraBoards]=useState<Record<string,Post[]>>({}),[inquiries,setInquiries]=useState<Inquiry[]>([]),[savedInquiryCategories,setSavedInquiryCategories]=useState<InquiryCategory[]>([]),[categoriesInitialized,setCategoriesInitialized]=useState(false),[boardDefinitions,setBoardDefinitions]=useState<BoardDefinition[]>(BOARD_DEFINITIONS);
  const [user,setUser]=useState<User|null>(null),[role,setRole]=useState(""),[permissions,setPermissions]=useState<Permission[]>([]);
  const [logoUrl,setLogoUrl]=useState(LOGO),[siteName,setSiteName]=useState("K-ON! FANDOM KR"),[accent,setAccent]=useState("#ff4f6d");
  const [authMode,setAuthMode]=useState<"login"|"register">("login"),[toast,setToast]=useState(""),[page,setPage]=useState(1),[termsAccepted,setTermsAccepted]=useState(false),[privacyAccepted,setPrivacyAccepted]=useState(false),[authNotice,setAuthNotice]=useState("");
  const isAdmin=role==="owner"||permissions.includes("applications");

  useEffect(()=>{const sync=()=>{setRoute(readRoute());setPage(1);window.scrollTo({top:0,behavior:"smooth"});};const frame=requestAnimationFrame(sync);window.addEventListener("hashchange",sync);return()=>{cancelAnimationFrame(frame);window.removeEventListener("hashchange",sync);};},[]);
  useEffect(()=>{
    if(!firebaseConfigured||!auth||!db)return;
    const firestore=db;
    const ua=onAuthStateChanged(auth,async next=>{setUser(next);if(!next){setRole("");setPermissions([]);return;}const access=await readAdminAccess(next,firestore);setRole(access.role);setPermissions(access.permissions as Permission[]);});
    const us=onSnapshot(doc(db,"siteSettings","main"),snap=>{if(!snap.exists())return;const data=snap.data();setLogoUrl(String(data.logoUrl||LOGO));setSiteName(String(data.siteName||"K-ON! FANDOM KR"));setAccent(String(data.accentColor||"#ff4f6d"));});
    const un=onSnapshot(query(collection(db,"news"),orderBy("createdAt","desc")),snap=>setNews(snap.docs.map(item=>({id:item.id,...item.data()} as Post))));
    const uo=onSnapshot(query(collection(db,"notices"),orderBy("createdAt","desc")),snap=>setNotices(snap.docs.map(item=>({id:item.id,...item.data()} as Post))));
    const uc=onSnapshot(collection(db,"inquiryCategories"),snap=>{const list=snap.docs.map(item=>({id:item.id,...item.data()} as InquiryCategory)).filter(item=>item.active!==false).sort((a,b)=>(a.order??0)-(b.order??0));setSavedInquiryCategories(list);});
    const uci=onSnapshot(doc(db,"inquiryCategorySettings","main"),snap=>setCategoriesInitialized(snap.exists()&&snap.data().initialized===true));
    const ub=onSnapshot(collection(db,"boardDefinitions"),snap=>{const list=snap.docs.map(item=>{const data=item.data() as Omit<BoardDefinition,"icon">;return {...data,collection:"boardPosts",key:data.key||item.id,icon:BOARD_BY_KEY[data.key||item.id]?.icon||Newspaper} as BoardDefinition;}).filter(item=>item.active!==false).sort((a,b)=>(a.order??0)-(b.order??0));setBoardDefinitions([...BOARD_DEFINITIONS,...list.filter(item=>!BOARD_DEFINITIONS.some(base=>base.key===item.key))]);});
    return()=>{ua();us();un();uo();uc();uci();ub();};
  },[]);
  useEffect(()=>{
    if(!db||!firebaseConfigured)return;
    const firestore=db;
    const extra=boardDefinitions.filter(board=>board.key!=="news"&&board.key!=="notices"&&board.key!=="inquiries");
    if(!extra.length)return;
    const unsubscribers=extra.map(board=>onSnapshot(query(collection(firestore,board.collection),orderBy("createdAt","desc")),snap=>setExtraBoards(previous=>({...previous,[board.key]:snap.docs.map(item=>({id:item.id,...item.data()} as Post)).filter(item=>board.collection!=="boardPosts"||String((item as Post & {boardKey?:string}).boardKey)===board.key)}))));
    return()=>unsubscribers.forEach(unsubscribe=>unsubscribe());
  },[boardDefinitions]);
  useEffect(()=>{
    if(!db||!user)return;
    const source=isAdmin?collection(db,"inquiries"):query(collection(db,"inquiries"),where("userId","==",user.uid));
    return onSnapshot(source,snap=>setInquiries(snap.docs.map(item=>({id:item.id,...item.data()} as Inquiry)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))));
  },[user,isAdmin]);

  const boardByKey=useMemo(()=>({...BOARD_BY_KEY,...Object.fromEntries(boardDefinitions.map(board=>[board.key,board]))}),[boardDefinitions]);
  const inquiryCategories=useMemo(()=>savedInquiryCategories.length?savedInquiryCategories:categoriesInitialized?[]:DEFAULT_INQUIRY_CATEGORIES,[savedInquiryCategories,categoriesInitialized]);
  const posts=useMemo(()=>route.tab==="news"?news:route.tab==="notices"?notices:extraBoards[route.tab]||[],[route.tab,news,notices,extraBoards]);
  const selectedPost=route.itemId&&route.tab!=="inquiries"?posts.find(item=>item.id===route.itemId):undefined;
  const selectedInquiry=route.itemId&&route.tab==="inquiries"?inquiries.find(item=>item.id===route.itemId):undefined;
  const pageSize=10;
  const pageItems=useMemo(()=>posts.slice((page-1)*pageSize,page*pageSize),[posts,page]);
  const pageCount=Math.max(1,Math.ceil(posts.length/pageSize));
  useEffect(()=>{if(!db||!user||route.tab!=="notices"||!selectedPost)return;void awardNoticeRead(db,user,selectedPost.id,selectedPost.title).catch(()=>undefined);},[user,route.tab,selectedPost]);

  async function memberAuth(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!auth)return setToast("Firebase 연결 후 로그인할 수 있습니다.");
    const form=new FormData(e.currentTarget);
    try{
      if(authMode==="register"){if(!termsAccepted||!privacyAccepted)return setAuthNotice("이용약관과 개인정보 처리방침에 모두 동의해 주세요.");if(!db)return setAuthNotice("Firebase 데이터베이스 연결 후 회원가입할 수 있습니다.");const requestedNickname=String(form.get("nickname")||window.prompt("가입에 사용할 닉네임을 입력해 주세요.")||"").trim();if(!requestedNickname)return setAuthNotice("닉네임을 입력해 주세요.");await registerWithEmail(auth,db,String(form.get("email")),String(form.get("password")),requestedNickname,String(form.get("referralCode")||""));setToast("인증 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.");}
      else {await loginWithEmail(auth,String(form.get("email")),String(form.get("password")));setToast("로그인했습니다.");}
    }catch(error){setAuthNotice("");setToast(authErrorMessage(error));}
  }
  async function googleAuth(){if(!auth)return setToast("Firebase 연결 후 로그인할 수 있습니다.");if(!termsAccepted||!privacyAccepted)return setAuthNotice("Google 로그인·가입 전에도 약관 동의가 필요합니다.");try{await loginWithGoogle(auth);setToast("Google 계정으로 로그인했습니다.");}catch(error){setToast(authErrorMessage(error));}}
  async function createInquiry(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!user||!db)return;
    const form=new FormData(e.currentTarget);
    const rich=String(form.get("bodyRich")||"");
    if(!String(form.get("body")||"").trim())return setToast("문의 내용을 입력해 주세요.");
    const created=await addDoc(collection(db,"inquiries"),{userId:user.uid,userEmail:user.email,title:String(form.get("title")),body:String(form.get("body")),bodyRich:rich?JSON.parse(rich):null,category:String(form.get("category")),attachmentName:String(form.get("attachmentName")||""),attachmentUrl:String(form.get("attachmentUrl")||""),private:form.get("private")==="on",createdAt:new Date().toISOString(),status:"waiting"});
    setToast("문의가 등록되었습니다.");
    window.location.hash=`inquiries/${created.id}`;
  }
  async function answerInquiry(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!db||!selectedInquiry||!isAdmin)return;
    const form=new FormData(e.currentTarget);
    const rich=String(form.get("answerRich")||"");
    if(!String(form.get("answer")||"").trim())return setToast("답변 내용을 입력해 주세요.");
    await updateDoc(doc(db,"inquiries",selectedInquiry.id),{answer:String(form.get("answer")),answerRich:rich?JSON.parse(rich):null,status:"answered",private:true,answeredAt:new Date().toISOString()});
    setToast("답변을 등록했습니다.");
  }

  const currentBoard=boardByKey[route.tab]||BOARD_BY_KEY.news;
  const CurrentIcon=currentBoard.icon;
  return <main className="boards-page" style={{"--accent":accent} as CSSProperties}>
    <PublicHeader siteName={siteName} logoUrl={logoUrl} active="boards" boards={boardDefinitions}/>
    {!firebaseConfigured&&<div className="setup-banner">미리보기 모드 · Firebase 연결 후 로그인과 문의 기능이 활성화됩니다.</div>}
    {toast&&<button className="toast" onClick={()=>setToast("")}>{toast}</button>}

    <section className="boards-hero"><div><Link href="/"><Home/>홈으로</Link><p>COMMUNITY BOARD</p><h1>팬덤 게시판</h1><span>소식과 공지, 내 문의를 한곳에서 확인하세요.</span></div></section>
    <nav className="board-tabs" aria-label="게시판 종류">{boardDefinitions.map(({key,label,icon:Icon})=><a key={key} href={`#${key}`} className={route.tab===key?"active":""}><Icon/>{label}</a>)}</nav>

    <section className="board-page-content">
      <div className="board-page-heading"><div><small>{route.tab.toUpperCase()}</small><h2><CurrentIcon/>{currentBoard.label} 게시판</h2><p>{currentBoard.description}</p></div>{route.tab==="inquiries"&&user&&!route.compose&&<a className="board-link-button" href="#inquiries/new"><PenLine/>문의 작성</a>}</div>

      {route.tab!=="inquiries"&&route.itemId&&<article className="board-article"><a className="back-link" href={`#${route.tab}`}><ArrowLeft/>목록으로</a>{selectedPost?<><div className="article-meta">{selectedPost.prefix&&<span>{selectedPost.prefix}</span>}<span>{selectedPost.category}</span><time>{formatDate(selectedPost.createdAt)}</time></div><h2>{selectedPost.title}</h2><div className="article-body">{postBody(selectedPost)}</div>{selectedPost.attachmentUrl&&<a className="file-attachment" href={directFileUrl(selectedPost.attachmentUrl)} target="_blank" rel="noreferrer">📎 {selectedPost.attachmentName||"첨부 파일 열기"}</a>}<PollBox post={selectedPost}/></>:<div className="board-empty">글을 찾을 수 없습니다.</div>}</article>}

      {route.tab!=="inquiries"&&!route.itemId&&<><div className="table-wrap board-table"><table><thead><tr><th>번호</th><th>분류</th><th>제목</th><th>작성일</th></tr></thead><tbody>{pageItems.length?pageItems.map((item,index)=><tr key={item.id}><td>{item.pinned?"필독":posts.length-((page-1)*pageSize+index)}</td><td>{item.category}</td><td><a className="title-button" href={`#${route.tab}/${item.id}`}>{item.title}</a></td><td>{formatDate(item.createdAt)}</td></tr>):<tr><td colSpan={4} className="empty-row">등록된 글이 없습니다.</td></tr>}</tbody></table></div><div className="pagination">{Array.from({length:pageCount},(_,index)=><button key={index} className={page===index+1?"active":""} onClick={()=>setPage(index+1)}>{index+1}</button>)}</div></>}

      {route.tab==="inquiries"&&!user&&<div className="board-auth"><MessageSquareText/><div><h3>로그인이 필요한 게시판입니다</h3><p>본인이 작성한 문의와 관리자 답변만 안전하게 확인할 수 있습니다.</p></div><form onSubmit={memberAuth}><Input name="email" type="email" placeholder="이메일" required/><Input name="password" type="password" minLength={6} placeholder="비밀번호 (6자 이상)" required/><div className="auth-consents"><label><input type="checkbox" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} required={authMode==="register"}/> <a href="/terms" target="_blank" rel="noreferrer">이용약관</a> 동의</label><label><input type="checkbox" checked={privacyAccepted} onChange={e=>setPrivacyAccepted(e.target.checked)} required={authMode==="register"}/> <a href="/privacy" target="_blank" rel="noreferrer">개인정보 처리방침</a> 동의</label></div>{authNotice&&<p className="auth-notice">{authNotice}</p>}<Button>{authMode==="login"?"이메일 로그인":"이메일 회원가입"}</Button></form><div className="auth-divider"><span>또는</span></div><Button type="button" variant="outline" onClick={googleAuth}>Google 계정으로 계속하기</Button><button className="text-link" onClick={()=>{setAuthMode(authMode==="login"?"register":"login");setAuthNotice("")}}>{authMode==="login"?"계정이 없나요? 회원가입":"이미 계정이 있나요? 로그인"}</button></div>}

      {route.tab==="inquiries"&&user&&route.compose&&<article className="board-editor"><a className="back-link" href="#inquiries"><ArrowLeft/>목록으로</a><h2>새 문의 작성</h2><p>본문 이미지는 편집기의 ‘이미지 URL’ 버튼으로 넣고, 일반 파일은 아래 첨부 링크로 등록하세요.</p><form className="form" onSubmit={createInquiry}><label>분류<select name="category">{inquiryCategories.map(category=><option key={category.id} value={category.label}>{category.label}</option>)}</select></label><label>제목<Input name="title" required/></label><FormRichTextEditor label="문의 내용"/><label>첨부 이름<Input name="attachmentName" placeholder="예: 행사 신청서.pdf"/></label><label>첨부 링크<Input name="attachmentUrl" type="url" placeholder="Google Drive, OneDrive 또는 외부 파일 링크"/></label><small className="attachment-guide">파일 자체 대신 공유 링크를 등록하세요. 링크의 공개 범위를 반드시 확인해야 합니다.</small><label className="check-line"><input name="private" type="checkbox"/> 비공개 문의로 등록</label><Button>문의 등록</Button></form></article>}

      {route.tab==="inquiries"&&user&&route.itemId&&!route.compose&&<article className="board-article"><a className="back-link" href="#inquiries"><ArrowLeft/>목록으로</a>{selectedInquiry?<><div className="article-meta"><span>{selectedInquiry.category}</span><span className={`status-pill ${selectedInquiry.status}`}>{selectedInquiry.status==="answered"?"답변 완료":"답변 대기"}</span><time>{formatDate(selectedInquiry.createdAt)}</time></div><h2>{selectedInquiry.title}</h2><div className="article-body">{richBody(selectedInquiry.body,selectedInquiry.bodyRich)}</div>{selectedInquiry.attachmentUrl&&<a className="file-attachment" href={directFileUrl(selectedInquiry.attachmentUrl)} target="_blank" rel="noreferrer">📎 {selectedInquiry.attachmentName||"첨부 링크 열기"}</a>}{selectedInquiry.answer&&<div className="board-answer"><b>관리자 답변</b>{richBody(selectedInquiry.answer,selectedInquiry.answerRich)}</div>}{isAdmin&&!selectedInquiry.answer&&<form className="form answer-form" onSubmit={answerInquiry}><FormRichTextEditor label="관리자 답변" name="answer" richName="answerRich"/><Button>답변 등록</Button></form>}</>:<div className="board-empty">문의 글을 찾을 수 없거나 열람 권한이 없습니다.</div>}</article>}

      {route.tab==="inquiries"&&user&&!route.itemId&&!route.compose&&<div className="table-wrap board-table"><table><thead><tr><th>분류</th><th>제목</th><th>작성일</th><th>상태</th></tr></thead><tbody>{inquiries.length?inquiries.map(item=><tr key={item.id}><td>{item.category}</td><td><a className="title-button" href={`#inquiries/${item.id}`}>{item.title}</a></td><td>{formatDate(item.createdAt)}</td><td><span className={`status-pill ${item.status}`}>{item.status==="answered"?"답변 완료":"답변 대기"}</span></td></tr>):<tr><td colSpan={4} className="empty-row">등록한 문의가 없습니다.</td></tr>}</tbody></table></div>}
    </section>
    <footer className="site-footer"><div className="brand"><Image src={logoUrl} alt="" width={124} height={44} unoptimized/><span>{siteName}</span></div><p>팬덤 작성 콘텐츠는 각 작성자에게 권리가 있으며, K-ON! 원작·상표·캐릭터의 권리는 각 권리자에게 있습니다. 비영리 비공식 팬 커뮤니티입니다.</p></footer>
  </main>;
}
