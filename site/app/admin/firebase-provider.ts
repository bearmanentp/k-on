"use client";

import type { AuthProvider, DataProvider, RaRecord } from "react-admin";
import { addDoc, collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, limit as firestoreLimit, orderBy, query, setDoc, where, writeBatch } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

const permissionByResource:Record<string,string> = {
  notices:"notices", news:"notices", events:"events", seatLayouts:"events", inquiries:"applications", inquiryCategories:"applications",
  reservations:"applications", accountMessages:"applications", adminNotices:"users", users:"users", pointHistory:"points", orders:"applications", ads:"design", products:"design", shops:"design", shopSettings:"design", imageHosting:"design", adminDirectory:"users", siteSettings:"design", boardDefinitions:"notices", boardPosts:"notices",
};

function requireDb(){if(!db)throw new Error("Firebase가 연결되지 않았습니다.");return db;}
let userReadyPromise:Promise<NonNullable<typeof auth>["currentUser"]>|null=null;
function waitForUser(){if(auth?.currentUser)return Promise.resolve(auth.currentUser);if(!userReadyPromise)userReadyPromise=new Promise((resolve,reject)=>{if(!auth)return reject(new Error("Firebase가 연결되지 않았습니다."));const stop=onAuthStateChanged(auth,user=>{stop();resolve(user);},error=>{userReadyPromise=null;reject(error);});});return userReadyPromise;}
function normalize(value:unknown):RaRecord {const record=value as RaRecord;return {...record,id:String(record.id)};}
function defaultSiteSettings(){return normalize({id:"main",siteName:"K-ON! FANDOM KR",logoUrl:"",fontFamily:'"Pretendard", "Noto Sans KR", system-ui, sans-serif',accentColor:"#ff4f6d",heroEyebrow:"AFTER SCHOOL, TOGETHER",heroTitle:"좋아하는 음악으로\n다시 만나는 우리",heroDescription:"",heroImages:[],characterImages:[],communityMessage:""});}
function defaultShop(){return normalize({id:"official",name:"팬덤 공식샵",description:"K-ON! FANDOM KR에서 운영하는 공식 팬덤 상점입니다.",active:true,order:0});}
function preparePayload(resource:string,data:Record<string,unknown>){if(resource==="boardDefinitions")return{...data,collection:"boardPosts"};if(resource==="products")return{...data,shopId:String(data.shopId||"official"),active:data.active!==false,price:Number(data.price||0)};if(resource==="shops")return{...data,active:data.active!==false,order:Number(data.order||0)};return data;}
function cleanValue(value:unknown):unknown{if(value===undefined)return undefined;if(Array.isArray(value))return value.map(cleanValue).filter(item=>item!==undefined);if(value&&typeof value==="object"){if(Object.getPrototypeOf(value)!==Object.prototype)return value;return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,cleanValue(item)]).filter(([,item])=>item!==undefined));}return value;}
function cleanPayload(value:Record<string,unknown>){return cleanValue(value) as Record<string,unknown>;}
type AdminAccess={user:NonNullable<NonNullable<typeof auth>["currentUser"]>;owner:boolean;permissions:string[]};
let accessCache:{uid:string;expiresAt:number;value:AdminAccess}|null=null;
async function currentAdminAccess(){
  const user=auth?.currentUser||await waitForUser();
  if(!user)return null;
  if(accessCache?.uid===user.uid&&accessCache.expiresAt>Date.now())return accessCache.value;
  const token=await user.getIdTokenResult();
  const value:AdminAccess={
    user,
    owner:token.claims.role==="owner",
    permissions:Array.isArray(token.claims.permissions)?token.claims.permissions.map(String):[],
  };
  accessCache={uid:user.uid,expiresAt:Date.now()+60_000,value};
  return value;
}
function assignedToShop(row:RaRecord,user:{uid:string;email:string|null}){
  const uids=Array.isArray(row.managerUids)?row.managerUids.map(String):[];
  const emails=Array.isArray(row.managerEmails)?row.managerEmails.map(value=>String(value).trim().toLowerCase()):[];
  return uids.includes(user.uid)||Boolean(user.email&&emails.includes(user.email.trim().toLowerCase()));
}
async function filterShopScopedRows(resource:string,rows:RaRecord[]){
  if(resource!=="shops"&&resource!=="products")return rows;
  const access=await currentAdminAccess();
  if(!access)return [];
  if(access.owner||access.permissions.includes("design"))return rows;
  if(!access.permissions.includes("shopManagers"))return [];
  const shopSnapshot=resource==="shops"?null:await getDocs(collection(requireDb(),"shops"));
  const shops=resource==="shops"?rows:shopSnapshot!.docs.map(item=>normalize({id:item.id,...item.data()}));
  const allowedShopIds=new Set(shops.filter(shop=>assignedToShop(shop,access.user)).map(shop=>String(shop.id)));
  return resource==="shops"?rows.filter(row=>allowedShopIds.has(String(row.id))):rows.filter(row=>allowedShopIds.has(String(row.shopId||"official")));
}

export const firebaseDataProvider:DataProvider = {
  async getList(resource,params){
    const source=collection(requireDb(),resource),filters=params.filter||{},hasClientFilter=Object.values(filters).some(Boolean);
    const pagination=params.pagination||{page:1,perPage:25},start=(pagination.page-1)*pagination.perPage;
    const serverPaged=!hasClientFilter&&!['products','shops','siteSettings'].includes(resource);
    const constraints=[];
    if(serverPaged&&params.sort?.field)constraints.push(orderBy(params.sort.field,params.sort.order==="DESC"?"desc":"asc"));
    if(serverPaged)constraints.push(firestoreLimit(pagination.page*pagination.perPage));
    let snapshot,totalFromServer:number|undefined;
    try{
      [snapshot,totalFromServer]=serverPaged
        ?await Promise.all([getDocs(query(source,...constraints)),getCountFromServer(source).then(result=>result.data().count)])
        :[await getDocs(source),undefined];
    }catch{
      // 정렬 필드가 없는 예전 문서나 아직 생성되지 않은 인덱스가 있어도 목록은 계속 동작합니다.
      snapshot=await getDocs(source);
      totalFromServer=undefined;
    }
    let rows=snapshot.docs.map(item=>normalize({id:item.id,...item.data()}));
    if(resource==="siteSettings"&&!rows.length)rows=[defaultSiteSettings()];
    if(resource==="shops"&&!rows.some(row=>row.id==="official"))rows=[defaultShop(),...rows];
    rows=await filterShopScopedRows(resource,rows);
    rows=rows.filter(row=>Object.entries(filters).every(([key,value])=>{if(!value)return true;const needle=String(value).toLowerCase();return key==="q"?Object.values(row).some(cell=>String(cell??"").toLowerCase().includes(needle)):String(row[key]??"").toLowerCase().includes(needle);}));
    const sort=params.sort;
    if(!serverPaged&&sort?.field)rows.sort((a,b)=>String(a[sort.field]??"").localeCompare(String(b[sort.field]??""))*(sort.order==="DESC"?-1:1));
    const total=totalFromServer??rows.length;
    return {data:rows.slice(start,start+pagination.perPage) as never,total};
  },
  async getOne(resource,params){const snapshot=await getDoc(doc(requireDb(),resource,String(params.id)));if(!snapshot.exists()){if(resource==="siteSettings"&&String(params.id)==="main")return{data:defaultSiteSettings() as never};if(resource==="shops"&&String(params.id)==="official")return{data:defaultShop() as never};throw new Error("데이터를 찾을 수 없습니다.");}return{data:normalize({id:snapshot.id,...snapshot.data()}) as never};},
  async getMany(resource,params){const rows=await Promise.all(params.ids.map(async id=>{const snapshot=await getDoc(doc(requireDb(),resource,String(id)));return snapshot.exists()?normalize({id:snapshot.id,...snapshot.data()}):null;}));return{data:rows.filter((row):row is RaRecord=>Boolean(row)) as never};},
  async getManyReference(resource,params){const snapshot=await getDocs(query(collection(requireDb(),resource),where(params.target,"==",params.id)));let rows=snapshot.docs.map(item=>normalize({id:item.id,...item.data()}));const filters=params.filter||{};rows=rows.filter(row=>Object.entries(filters).every(([key,value])=>!value||String(row[key]??"").toLowerCase().includes(String(value).toLowerCase())));if(params.sort?.field)rows.sort((a,b)=>String(a[params.sort.field]??"").localeCompare(String(b[params.sort.field]??""))*(params.sort.order==="DESC"?-1:1));const total=rows.length,pagination=params.pagination||{page:1,perPage:25},start=(pagination.page-1)*pagination.perPage;return{data:rows.slice(start,start+pagination.perPage) as never,total};},
  async create(resource,params){const prepared=preparePayload(resource,params.data as Record<string,unknown>);const payload=cleanPayload({...prepared,createdAt:prepared.createdAt||new Date().toISOString()});const created=await addDoc(collection(requireDb(),resource),payload);return{data:normalize({id:created.id,...payload}) as never};},
  async update(resource,params){const prepared=preparePayload(resource,params.data as Record<string,unknown>);const payload=cleanPayload({...prepared,updatedAt:new Date().toISOString()});delete payload.id;await setDoc(doc(requireDb(),resource,String(params.id)),payload,{merge:true});return{data:normalize({id:params.id,...prepared,...payload}) as never};},
  async updateMany(resource,params){const batch=writeBatch(requireDb());params.ids.forEach(id=>batch.set(doc(requireDb(),resource,String(id)),cleanPayload({...params.data,updatedAt:new Date().toISOString()}),{merge:true}));await batch.commit();return{data:params.ids};},
  async delete(resource,params){await deleteDoc(doc(requireDb(),resource,String(params.id)));return{data:normalize(params.previousData||{id:params.id}) as never};},
  async deleteMany(resource,params){const batch=writeBatch(requireDb());params.ids.forEach(id=>batch.delete(doc(requireDb(),resource,String(id))));await batch.commit();return{data:params.ids};},
};

export const firebaseAuthProvider:AuthProvider = {
  async login({username,password}){if(!auth)throw new Error("Firebase가 연결되지 않았습니다.");const credential=await signInWithEmailAndPassword(auth,username,password);userReadyPromise=Promise.resolve(credential.user);accessCache=null;const token=await credential.user.getIdTokenResult(true);if(token.claims.role!=="owner"&&(!Array.isArray(token.claims.permissions)||token.claims.permissions.length===0)){await signOut(auth);userReadyPromise=null;throw new Error("관리자 권한이 없습니다.");}},
  async logout(){accessCache=null;userReadyPromise=null;if(auth)await signOut(auth);},
  async checkAuth(){const user=auth?.currentUser||await waitForUser();if(!user)throw new Error("로그인이 필요합니다.");const token=await user.getIdTokenResult();if(token.claims.role!=="owner"&&(!Array.isArray(token.claims.permissions)||token.claims.permissions.length===0))throw new Error("관리자 권한이 없습니다.");},
  async checkError(){},
  async getIdentity(){const user=auth?.currentUser||await waitForUser();if(!user)throw new Error("로그인이 필요합니다.");return{id:user.uid,fullName:user.email||"관리자"};},
  async getPermissions(){const user=auth?.currentUser||await waitForUser();if(!user)return[];const token=await user.getIdTokenResult();if(token.claims.role==="owner")return["owner"];const permissions=Array.isArray(token.claims.permissions)?token.claims.permissions:[];return token.claims.role==="deputy"?["deputy",...permissions]:permissions;},
  async canAccess({resource,action}){const user=auth?.currentUser||await waitForUser();if(!user)return false;const token=await user.getIdTokenResult();if(token.claims.role==="owner")return true;const permissions=Array.isArray(token.claims.permissions)?token.claims.permissions:[];if(resource==="accountMessages")return permissions.includes("applications")||permissions.includes("events");if(resource==="products")return permissions.includes("design")||permissions.includes("shopManagers");if(resource==="shops")return permissions.includes("design")||(permissions.includes("shopManagers")&&["list","show"].includes(String(action)));if(resource==="adminNotices"&&["list","show"].includes(String(action)))return true;return permissions.includes(permissionByResource[resource]);},
};
