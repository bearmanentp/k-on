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
import { Textarea } from "@/components/ui/textarea";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { BOARD_BY_KEY, BOARD_DEFINITIONS, type BoardDefinition, type BoardKey } from "@/lib/board-config";
import { authErrorMessage, loginWithEmail, loginWithGoogle, registerWithEmail } from "@/lib/auth";

type BoardTab = BoardKey;
type Permission = "design" | "events" | "notices" | "applications" | "users" | "points";
type Post = { id:string; title:string; body:string; bodyRich?:unknown; category:string; createdAt:string; pinned?:boolean };
type Inquiry = { id:string; userId:string; userEmail:string; title:string; body:string; category:string; createdAt:string; status:"waiting"|"answered"; answer?:string; private?:boolean };
type InquiryCategory = { id:string; label:string; description?:string; active?:boolean; order?:number };
type RouteState = { tab:BoardTab; itemId?:string; compose?:boolean };

const LOGO = "https://upload.wikimedia.org/wikipedia/commons/1/17/K-ON_anime_wordmark.svg";
const DEFAULT_INQUIRY_CATEGORIES:InquiryCategory[] = [{id:"event",label:"행사"},{id:"reservation",label:"예약"},{id:"site",label:"사이트 이용"},{id:"etc",label:"기타"}];

function readRoute():RouteState {
  if(typeof window==="undefined")return{tab:"news"};
  const [rawTab,rawItem]=window.location.hash.replace(/^#/,"").split("/");
  const tab:BoardTab=BOARD_BY_KEY[rawTab as BoardKey]?rawTab as BoardKey:"news";
  return {tab,itemId:rawItem&&rawItem!=="new"?decodeURIComponent(rawItem):undefined,compose:tab==="inquiries"&&rawItem==="new"};
}
function formatDate(value:string){return new Date(value).toLocaleDateString("ko-KR");}
function postBody(post:Post){if(!post.bodyRich||typeof post.bodyRich!=="object")return <p>{post.body}</p>;try{return <div dangerouslySetInnerHTML={{__html:generateHTML(post.bodyRich as Parameters<typeof generateHTML>[0],[StarterKit])}}/>;}catch{return <p>{post.body}</p>;}}

export default function BoardsPage(){
  const [route,setRoute]=useState<RouteState>({tab:"news"});
  const [news,setNews]=useState<Post[]>([]),[notices,setNotices]=useState<Post[]>([]),[extraBoards,setExtraBoards]=useState<Record<string,Post[]>>({}),[inquiries,setInquiries]=useState<Inquiry[]>([]),[inquiryCategories,setInquiryCategories]=useState<InquiryCategory[]>(DEFAULT_INQUIRY_CATEGORIES),[boardDefinitions,setBoardDefinitions]=useState<BoardDefinition[]>(BOARD_DEFINITIONS);
  const [user,setUser]=useState<User|null>(null),[role,setRole]=useState(""),[permissions,setPermissions]=useState<Permission[]>([]);
  const [logoUrl,setLogoUrl]=useState(LOGO),[siteName,setSiteName]=useState("K-ON! FANDOM KR"),[accent,setAccent]=useState("#ff4f6d");
  const [authMode,setAuthMode]=useState<"login"|"register">("login"),[toast,setToast]=useState(""),[page,setPage]=useState(1),[termsAccepted,setTermsAccepted]=useState(false),[privacyAccepted,setPrivacyAccepted]=useState(false),[authNotice,setAuthNotice]=useState("");
  const isAdmin=role==="owner"||permissions.includes("applications");

  useEffect(()=>{const sync=()=>{setRoute(readRoute());setPage(1);window.scrollTo({top:0,behavior:"smooth"});};const frame=requestAnimationFrame(sync);window.addEventListener("hashchange",sync);return()=>{cancelAnimationFrame(frame);window.removeEventListener("hashchange",sync);};},[]);
  useEffect(()=>{
    if(!firebaseConfigured||!auth||!db)return;
    const ua=onAuthStateChanged(auth,async next=>{setUser(next);const token=next?await next.getIdTokenResult(true):null;setRole(String(token?.claims.role||""));setPermissions(Array.isArray(token?.claims.permissions)?token.claims.permissions as Permission[]:[]);});
    const us=onSnapshot(doc(db,"siteSettings","main"),snap=>{if(!snap.exists())return;const data=snap.data();setLogoUrl(String(data.logoUrl||LOGO));setSiteName(String(data.siteName||"K-ON! FANDOM KR"));setAccent(String(data.accentColor||"#ff4f6d"));});
    const un=onSnapshot(query(collection(db,"news"),orderBy("createdAt","desc")),snap=>setNews(snap.docs.map(item=>({id:item.id,...item.data()} as Post))));
    const uo=onSnapshot(query(collection(db,"notices"),orderBy("createdAt","desc")),snap=>setNotices(snap.docs.map(item=>({id:item.id,...item.data()} as Post))));
    const uc=onSnapshot(collection(db,"inquiryCategories"),snap=>{const list=snap.docs.map(item=>({id:item.id,...item.data()} as InquiryCategory)).filter(item=>item.active!==false).sort((a,b)=>(a.order??0)-(b.order??0));setInquiryCategories(list.length?list:DEFAULT_INQUIRY_CATEGORIES);});
    const ub=onSnapshot(collection(db,"boardDefinitions"),snap=>{const list=snap.docs.map(item=>{const data=item.data() as Omit<BoardDefinition,"icon">;return {...data,key:data.key||item.id,icon:BOARD_BY_KEY[data.key||item.id]?.icon||Newspaper} as BoardDefinition;}).filter(item=>item.active!==false).sort((a,b)=>(a.order??0)-(b.order??0));if(list.length)setBoardDefinitions([...BOARD_DEFINITIONS,...list.filter(item=>!BOARD_DEFINITIONS.some(base=>base.key===item.key))]);});
    return()=>{ua();us();un();uo();uc();ub();};
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
  const posts=useMemo(()=>route.tab==="news"?news:route.tab==="notices"?notices:extraBoards[route.tab]||[],[route.tab,news,notices,extraBoards]);
  const selectedPost=route.itemId&&route.tab!=="inquiries"?posts.find(item=>item.id===route.itemId):undefined;
  const selectedInquiry=route.itemId&&route.tab==="inquiries"?inquiries.find(item=>item.id===route.itemId):undefined;
  const pageSize=10;
  const pageItems=useMemo(()=>posts.slice((page-1)*pageSize,page*pageSize),[posts,page]);
  const pageCount=Math.max(1,Math.ceil(posts.length/pageSize));

  async function memberAuth(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!auth)return setToast("Firebase 연결 후 로그인할 수 있습니다.");
    const form=new FormData(e.currentTarget);
    try{
      if(authMode==="register"){if(!termsAccepted||!privacyAccepted)return setAuthNotice("이용약관과 개인정보 처리방침에 모두 동의해 주세요.");await registerWithEmail(auth,String(form.get("email")),String(form.get("password")));setToast("인증 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.");}
      else {await loginWithEmail(auth,String(form.get("email")),String(form.get("password")));setToast("로그인했습니다.");}
    }catch(error){setAuthNotice("");setToast(authErrorMessage(error));}
  }
  async function googleAuth(){if(!auth)return setToast("Firebase 연결 후 로그인할 수 있습니다.");if(!termsAccepted||!privacyAccepted)return setAuthNotice("Google 로그인·가입 전에도 약관 동의가 필요합니다.");try{await loginWithGoogle(auth);setToast("Google 계정으로 로그인했습니다.");}catch(error){setToast(authErrorMessage(error));}}
  async function createInquiry(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!user||!db)return;
    const form=new FormData(e.currentTarget);
    const created=await addDoc(collection(db,"inquiries"),{userId:user.uid,userEmail:user.email,title:String(form.get("title")),body:String(form.get("body")),category:String(form.get("category")),private:form.get("private")==="on",createdAt:new Date().toISOString(),status:"waiting"});
    setToast("문의가 등록되었습니다.");
    window.location.hash=`inquiries/${created.id}`;
  }
  async function answerInquiry(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!db||!selectedInquiry||!isAdmin)return;
    const form=new FormData(e.currentTarget);
    await updateDoc(doc(db,"inquiries",selectedInquiry.id),{answer:String(form.get("answer")),status:"answered",private:true,answeredAt:new Date().toISOString()});
    setToast("답변을 등록했습니다.");
  }

  const CurrentIcon=boardByKey[route.tab].icon;
  return <main className="boards-page" style={{"--accent":accent} as CSSProperties}>
    <header className="site-header boards-header"><Link href="/" className="brand"><Image src={logoUrl} alt="K-ON!" width={124} height={44} unoptimized/><span>{siteName}</span></Link><nav className="desktop-nav"><Link href="/">홈</Link><Link href="/#about">소개</Link><Link href="/#site-map">둘러보기</Link><Link href="/#characters">캐릭터</Link><Link href="/#events">행사·예약</Link><details className="nav-dropdown"><summary>커뮤니티</summary><div>{boardDefinitions.map(({key,menuLabel,icon:Icon})=><Link href={`/boards#${key}`} key={key}><Icon/>{menuLabel}</Link>)}</div></details></nav><details className="mobile-nav"><summary aria-label="전체 메뉴 열기"><span className="toggler-icon" aria-hidden="true"><i/><i/><i/></span><span className="sr-menu-label">메뉴</span></summary><div><Link href="/">홈</Link><Link href="/#about">소개</Link><Link href="/#site-map">둘러보기</Link><Link href="/#characters">캐릭터</Link><Link href="/#events">행사·예약</Link><details className="mobile-community"><summary><Newspaper/>커뮤니티</summary><div>{boardDefinitions.map(({key,menuLabel,icon:Icon})=><Link href={`/boards#${key}`} key={key}><Icon/>{menuLabel}</Link>)}</div></details></div></details><div className="header-actions">{user?<Button variant="outline" onClick={()=>auth&&signOut(auth)}><LogOut/>로그아웃</Button>:<span className="member-state"><CircleUserRound/>비회원</span>}</div></header>
    {!firebaseConfigured&&<div className="setup-banner">미리보기 모드 · Firebase 연결 후 로그인과 문의 기능이 활성화됩니다.</div>}
    {toast&&<button className="toast" onClick={()=>setToast("")}>{toast}</button>}

    <section className="boards-hero"><div><Link href="/"><Home/>홈으로</Link><p>COMMUNITY BOARD</p><h1>팬덤 게시판</h1><span>소식과 공지, 내 문의를 한곳에서 확인하세요.</span></div></section>
    <nav className="board-tabs" aria-label="게시판 종류">{boardDefinitions.map(({key,label,icon:Icon})=><a key={key} href={`#${key}`} className={route.tab===key?"active":""}><Icon/>{label}</a>)}</nav>

    <section className="board-page-content">
      <div className="board-page-heading"><div><small>{route.tab.toUpperCase()}</small><h2><CurrentIcon/>{boardByKey[route.tab].label} 게시판</h2><p>{boardByKey[route.tab].description}</p></div>{route.tab==="inquiries"&&user&&!route.compose&&<a className="board-link-button" href="#inquiries/new"><PenLine/>문의 작성</a>}</div>

      {route.tab!=="inquiries"&&route.itemId&&<article className="board-article"><a className="back-link" href={`#${route.tab}`}><ArrowLeft/>목록으로</a>{selectedPost?<><div className="article-meta"><span>{selectedPost.category}</span><time>{formatDate(selectedPost.createdAt)}</time></div><h2>{selectedPost.title}</h2><div className="article-body">{postBody(selectedPost)}</div></>:<div className="board-empty">글을 찾을 수 없습니다.</div>}</article>}

      {route.tab!=="inquiries"&&!route.itemId&&<><div className="table-wrap board-table"><table><thead><tr><th>번호</th><th>분류</th><th>제목</th><th>작성일</th></tr></thead><tbody>{pageItems.length?pageItems.map((item,index)=><tr key={item.id}><td>{item.pinned?"필독":posts.length-((page-1)*pageSize+index)}</td><td>{item.category}</td><td><a className="title-button" href={`#${route.tab}/${item.id}`}>{item.title}</a></td><td>{formatDate(item.createdAt)}</td></tr>):<tr><td colSpan={4} className="empty-row">등록된 글이 없습니다.</td></tr>}</tbody></table></div><div className="pagination">{Array.from({length:pageCount},(_,index)=><button key={index} className={page===index+1?"active":""} onClick={()=>setPage(index+1)}>{index+1}</button>)}</div></>}

      {route.tab==="inquiries"&&!user&&<div className="board-auth"><MessageSquareText/><div><h3>로그인이 필요한 게시판입니다</h3><p>본인이 작성한 문의와 관리자 답변만 안전하게 확인할 수 있습니다.</p></div><form onSubmit={memberAuth}><Input name="email" type="email" placeholder="이메일" required/><Input name="password" type="password" minLength={6} placeholder="비밀번호 (6자 이상)" required/><div className="auth-consents"><label><input type="checkbox" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} required={authMode==="register"}/> <a href="/terms" target="_blank" rel="noreferrer">이용약관</a> 동의</label><label><input type="checkbox" checked={privacyAccepted} onChange={e=>setPrivacyAccepted(e.target.checked)} required={authMode==="register"}/> <a href="/privacy" target="_blank" rel="noreferrer">개인정보 처리방침</a> 동의</label></div>{authNotice&&<p className="auth-notice">{authNotice}</p>}<Button>{authMode==="login"?"이메일 로그인":"이메일 회원가입"}</Button></form><div className="auth-divider"><span>또는</span></div><Button type="button" variant="outline" onClick={googleAuth}>Google 계정으로 계속하기</Button><button className="text-link" onClick={()=>{setAuthMode(authMode==="login"?"register":"login");setAuthNotice("")}}>{authMode==="login"?"계정이 없나요? 회원가입":"이미 계정이 있나요? 로그인"}</button></div>}

      {route.tab==="inquiries"&&user&&route.compose&&<article className="board-editor"><a className="back-link" href="#inquiries"><ArrowLeft/>목록으로</a><h2>새 문의 작성</h2><p>답변이 등록되면 계정 알림함과 허용된 브라우저 알림으로 안내합니다.</p><form className="form" onSubmit={createInquiry}><label>분류<select name="category">{inquiryCategories.map(category=><option key={category.id} value={category.label}>{category.label}</option>)}</select></label><label>제목<Input name="title" required/></label><label>문의 내용<Textarea name="body" rows={10} required/></label><label className="check-line"><input name="private" type="checkbox"/> 비공개 문의로 등록</label><Button>문의 등록</Button></form></article>}

      {route.tab==="inquiries"&&user&&route.itemId&&!route.compose&&<article className="board-article"><a className="back-link" href="#inquiries"><ArrowLeft/>목록으로</a>{selectedInquiry?<><div className="article-meta"><span>{selectedInquiry.category}</span><span className={`status-pill ${selectedInquiry.status}`}>{selectedInquiry.status==="answered"?"답변 완료":"답변 대기"}</span><time>{formatDate(selectedInquiry.createdAt)}</time></div><h2>{selectedInquiry.title}</h2><div className="article-body">{selectedInquiry.body}</div>{selectedInquiry.answer&&<div className="board-answer"><b>관리자 답변</b><p>{selectedInquiry.answer}</p></div>}{isAdmin&&!selectedInquiry.answer&&<form className="form answer-form" onSubmit={answerInquiry}><label>관리자 답변<Textarea name="answer" rows={7} required/></label><Button>답변 등록</Button></form>}</>:<div className="board-empty">문의 글을 찾을 수 없거나 열람 권한이 없습니다.</div>}</article>}

      {route.tab==="inquiries"&&user&&!route.itemId&&!route.compose&&<div className="table-wrap board-table"><table><thead><tr><th>분류</th><th>제목</th><th>작성일</th><th>상태</th></tr></thead><tbody>{inquiries.length?inquiries.map(item=><tr key={item.id}><td>{item.category}</td><td><a className="title-button" href={`#inquiries/${item.id}`}>{item.title}</a></td><td>{formatDate(item.createdAt)}</td><td><span className={`status-pill ${item.status}`}>{item.status==="answered"?"답변 완료":"답변 대기"}</span></td></tr>):<tr><td colSpan={4} className="empty-row">등록한 문의가 없습니다.</td></tr>}</tbody></table></div>}
    </section>
    <footer><div className="brand"><Image src={logoUrl} alt="" width={124} height={44} unoptimized/><span>{siteName}</span></div><p>팬덤 작성 콘텐츠는 각 작성자에게 권리가 있으며, K-ON! 원작·상표·캐릭터의 권리는 각 권리자에게 있습니다. 비영리 비공식 팬 커뮤니티입니다.</p></footer>
  </main>;
}
