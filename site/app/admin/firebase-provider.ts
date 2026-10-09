"use client";

import type { AuthProvider, DataProvider, RaRecord } from "react-admin";
import { addDoc, collection, deleteDoc, doc, DocumentData, DocumentReference, DocumentSnapshot, getCountFromServer, getDoc, getDocs, limit as firestoreLimit, orderBy, query, runTransaction, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { DEFAULT_CHARACTER_IMAGES, DEFAULT_K_ON_LOGO } from "@/lib/site-defaults";
import { purchaseReward } from "@/lib/points";

const permissionByResource:Record<string,string> = {
  notices:"notices", news:"notices", events:"events", seatLayouts:"events", inquiries:"applications", inquiryCategories:"applications",
  reservations:"applications", accountMessages:"applications", adminNotices:"users", users:"users", pointHistory:"points", pointSettings:"points", orders:"applications", ads:"design", products:"design", shops:"design", shopSettings:"design", imageHosting:"design", adminDirectory:"users", siteSettings:"design", boardDefinitions:"notices", boardPosts:"notices",
};

function requireDb(){if(!db)throw new Error("Firebase가 연결되지 않았습니다.");return db;}
async function firebaseRequest<T>(request:Promise<T>,label:string,timeout=12_000){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([request,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} 시간이 초과됐습니다. Firebase 연결 상태를 확인해 주세요.`)),timeout);})]);}finally{if(timer)clearTimeout(timer);}}
let userReadyPromise:Promise<NonNullable<typeof auth>["currentUser"]>|null=null;
function waitForUser(){if(auth?.currentUser)return Promise.resolve(auth.currentUser);if(!userReadyPromise)userReadyPromise=new Promise((resolve,reject)=>{if(!auth)return reject(new Error("Firebase가 연결되지 않았습니다."));const stop=onAuthStateChanged(auth,user=>{stop();resolve(user);},error=>{userReadyPromise=null;reject(error);});});return userReadyPromise;}
function normalize(value:unknown):RaRecord {const record=value as RaRecord;return {...record,id:String(record.id)};}
function defaultSiteSettings(){return normalize({id:"main",siteName:"K-ON! FANDOM KR",logoUrl:DEFAULT_K_ON_LOGO,fontFamily:'"Pretendard", "Noto Sans KR", system-ui, sans-serif',accentColor:"#ff4f6d",heroEyebrow:"AFTER SCHOOL, TOGETHER",heroTitle:"좋아하는 음악으로\n다시 만나는 우리",heroDescription:"K-ON!의 음악과 일상을 함께 기억하고 새로운 순간을 만드는 한국 팬 커뮤니티.",heroImages:["/hero-music-room.png"],characterImages:DEFAULT_CHARACTER_IMAGES,communityMessage:"좋아하는 마음은 시간이 지나도 계속 연주됩니다."});}
function defaultShop(){return normalize({id:"official",name:"팬덤 공식샵",description:"K-ON! FANDOM KR에서 운영하는 공식 팬덤 상점입니다.",active:true,order:0});}
function preparePayload(resource:string,data:Record<string,unknown>){if(resource==="boardDefinitions")return{...data,collection:"boardPosts"};if(resource==="products")return{...data,shopId:String(data.shopId||"official"),active:data.active!==false,price:Number(data.price||0),rewardMode:String(data.rewardMode||"default"),rewardPoints:Number(data.rewardPoints||0)};if(resource==="shops")return{...data,active:data.active!==false,order:Number(data.order||0)};return data;}
function cleanValue(value:unknown):unknown{if(value===undefined)return undefined;if(Array.isArray(value))return value.map(cleanValue).filter(item=>item!==undefined);if(value&&typeof value==="object"){if(Object.getPrototypeOf(value)!==Object.prototype)return value;return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,cleanValue(item)]).filter(([,item])=>item!==undefined));}return value;}
function cleanPayload(value:Record<string,unknown>){return cleanValue(value) as Record<string,unknown>;}
const reservationStatusLabel:Record<string,string>={reviewing:"예약을 검토하고 있습니다.",confirmed:"예약이 확정되었습니다.",completed:"예약 안내가 완료되었습니다.",canceled:"예약이 취소되었습니다."};

async function updateWithSideEffects(resource:string,id:string,payload:Record<string,unknown>){
  const firestore=requireDb(),target=doc(firestore,resource,id);
  if(resource!=="reservations"&&resource!=="inquiries"&&resource!=="orders"){
    await setDoc(target,payload,{merge:true});
    return;
  }
  await runTransaction(firestore,async transaction=>{
    const currentSnapshot=await transaction.get(target);
    const current=currentSnapshot.data()||{};
    const nextStatus=String(payload.status||current.status||"");
    let counterSnapshot:DocumentSnapshot<DocumentData>|null=null;
    let counterRef:DocumentReference<DocumentData>|null=null;
    if(resource==="reservations"&&current.status!=="canceled"&&nextStatus==="canceled"&&current.bookingType!=="assigned_seat"){
      counterRef=doc(firestore,"events",String(current.eventId),"reservationMeta","counter");
      counterSnapshot=await transaction.get(counterRef);
    }
    let purchasePoints=0,purchaseBalance=0,purchaseLedgerExists=true;
    const purchaseLedgerId=`order_${id}`;
    if(resource==="orders"&&current.status!=="delivered"&&nextStatus==="delivered"&&current.userId){
      const settingsRef=doc(firestore,"pointSettings","main"),productRef=doc(firestore,"products",String(current.productId)),userRef=doc(firestore,"users",String(current.userId)),ledgerRef=doc(firestore,"pointLedger",purchaseLedgerId);
      const [settingsSnapshot,productSnapshot,userSnapshot,ledgerSnapshot]=await Promise.all([transaction.get(settingsRef),transaction.get(productRef),transaction.get(userRef),transaction.get(ledgerRef)]);
      purchaseLedgerExists=ledgerSnapshot.exists();
      if(!purchaseLedgerExists&&userSnapshot.exists()){
        purchasePoints=purchaseReward(settingsSnapshot.data()||{},Number(current.amount||0),productSnapshot.data());
        purchaseBalance=Math.max(0,Number(userSnapshot.data()?.points||0)+purchasePoints);
      }
    }
    if(resource==="orders"&&current.status!=="delivered"&&nextStatus==="delivered"){
      payload.pointsAwarded=purchasePoints;
      payload.pointsAwardedAt=new Date().toISOString();
    }
    transaction.set(target,payload,{merge:true});
    if(resource==="reservations"&&current.status!==nextStatus){
      if(nextStatus==="canceled"&&current.seatLabel)transaction.delete(doc(firestore,"events",String(current.eventId),"seats",String(current.seatLabel).toUpperCase()));
      if(counterRef&&counterSnapshot?.exists())transaction.set(counterRef,{activeCount:Math.max(0,Number(counterSnapshot.data().activeCount||0)-1),updatedAt:serverTimestamp()},{merge:true});
      if(current.userId)transaction.set(doc(collection(firestore,"accountMessages")),{
        userId:current.userId,userEmail:current.userEmail||"",title:current.eventTitle||"K-ON! 행사 예약",
        body:reservationStatusLabel[nextStatus]||"예약 상태가 변경되었습니다.",kind:"reservation_status",reservationId:id,
        createdAt:new Date().toISOString(),read:false,url:"/mypage",
      });
    }
    if(resource==="inquiries"&&current.status!=="answered"&&nextStatus==="answered"&&current.userId)transaction.set(doc(collection(firestore,"accountMessages")),{
      userId:current.userId,userEmail:current.userEmail||"",title:`문의 답변: ${current.title||"문의"}`,
      body:String(payload.answer||"관리자 답변이 등록되었습니다."),kind:"inquiry_answer",inquiryId:id,
      createdAt:new Date().toISOString(),read:false,url:"/boards#inquiries",
    });
    if(resource==="orders"&&current.status!=="delivered"&&nextStatus==="delivered"&&current.userId&&!purchaseLedgerExists){
      const createdAt=new Date().toISOString();
      transaction.set(doc(firestore,"pointLedger",purchaseLedgerId),{userId:current.userId,userEmail:current.userEmail||"",kind:"purchase",sourceId:id,delta:purchasePoints,balance:purchaseBalance,createdAt,createdAtServer:serverTimestamp()});
      transaction.set(doc(firestore,"pointHistory",purchaseLedgerId),{userId:current.userId,userEmail:current.userEmail||"",kind:"purchase",sourceId:id,delta:purchasePoints,balance:purchaseBalance,reason:`상품 구매 완료: ${current.productName||"상품"}`.slice(0,200),createdAt,createdAtServer:serverTimestamp(),createdBy:auth?.currentUser?.uid||""});
      transaction.set(doc(firestore,"users",String(current.userId)),{points:purchaseBalance,pointsUpdatedAt:createdAt,lastPointLedgerId:purchaseLedgerId},{merge:true});
      transaction.set(doc(collection(firestore,"accountMessages")),{userId:current.userId,userEmail:current.userEmail||"",title:"상품 구매 포인트 지급",body:`${current.productName||"상품"} 전달 완료로 ${purchasePoints.toLocaleString()}P가 지급되었습니다.`,kind:"purchase_points",orderId:id,createdAt,read:false,url:"/mypage"});
    }
  });
}

async function deleteWithSideEffects(resource:string,id:string){
  const firestore=requireDb(),target=doc(firestore,resource,id);
  if(resource!=="reservations"){await deleteDoc(target);return;}
  await runTransaction(firestore,async transaction=>{
    const snapshot=await transaction.get(target);
    if(!snapshot.exists())return;
    const current=snapshot.data();
    let counterRef:DocumentReference<DocumentData>|null=null,counterSnapshot:DocumentSnapshot<DocumentData>|null=null;
    if(current.status!=="canceled"&&current.bookingType!=="assigned_seat"){
      counterRef=doc(firestore,"events",String(current.eventId),"reservationMeta","counter");
      counterSnapshot=await transaction.get(counterRef);
    }
    transaction.delete(target);
    if(current.seatLabel)transaction.delete(doc(firestore,"events",String(current.eventId),"seats",String(current.seatLabel).toUpperCase()));
    if(counterRef&&counterSnapshot?.exists())transaction.set(counterRef,{activeCount:Math.max(0,Number(counterSnapshot.data().activeCount||0)-1),updatedAt:serverTimestamp()},{merge:true});
  });
}
type AdminAccess={user:NonNullable<NonNullable<typeof auth>["currentUser"]>;owner:boolean;role:string;permissions:string[]};
let accessCache:{uid:string;expiresAt:number;value:AdminAccess}|null=null;
async function currentAdminAccess(){
  const user=auth?.currentUser||await waitForUser();
  if(!user)return null;
  if(accessCache?.uid===user.uid&&accessCache.expiresAt>Date.now())return accessCache.value;
  const token=await user.getIdTokenResult();
  const email=String(user.email||"").trim().toLowerCase();
  const directorySnapshot=email?await getDoc(doc(requireDb(),"adminDirectory",email)):null;
  const directory=directorySnapshot?.data()||{};
  const directoryActive=directory.active===true;
  const tokenPermissions=Array.isArray(token.claims.permissions)?token.claims.permissions.map(String):[];
  const directoryPermissions=directoryActive&&Array.isArray(directory.permissions)?directory.permissions.map(String):[];
  const owner=token.claims.role==="owner";
  const value:AdminAccess={
    user,
    owner,
    role:owner?"owner":String((directoryActive&&directory.role)||token.claims.role||"member"),
    permissions:Array.from(new Set([...tokenPermissions,...directoryPermissions])),
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
    // 예전 회원 문서에는 정렬 필드가 없을 수 있어 users는 전체를 읽고 클라이언트에서 정렬합니다.
    const serverPaged=!hasClientFilter&&!['products','shops','siteSettings','users'].includes(resource);
    const constraints=[];
    if(serverPaged&&params.sort?.field)constraints.push(orderBy(params.sort.field,params.sort.order==="DESC"?"desc":"asc"));
    if(serverPaged)constraints.push(firestoreLimit(pagination.page*pagination.perPage));
    let snapshot,totalFromServer:number|undefined;
    try{
      [snapshot,totalFromServer]=serverPaged
        ?await firebaseRequest(Promise.all([getDocs(query(source,...constraints)),getCountFromServer(source).then(result=>result.data().count)]),"목록 불러오기")
        :[await firebaseRequest(getDocs(source),"목록 불러오기"),undefined];
    }catch{
      // 정렬 필드가 없는 예전 문서나 아직 생성되지 않은 인덱스가 있어도 목록은 계속 동작합니다.
      snapshot=await firebaseRequest(getDocs(source),"목록 불러오기");
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
  async getOne(resource,params){const snapshot=await firebaseRequest(getDoc(doc(requireDb(),resource,String(params.id))),"데이터 불러오기");if(!snapshot.exists()){if(resource==="siteSettings"&&String(params.id)==="main")return{data:defaultSiteSettings() as never};if(resource==="shops"&&String(params.id)==="official")return{data:defaultShop() as never};throw new Error("데이터를 찾을 수 없습니다.");}return{data:normalize({id:snapshot.id,...snapshot.data()}) as never};},
  async getMany(resource,params){const rows=await firebaseRequest(Promise.all(params.ids.map(async id=>{const snapshot=await getDoc(doc(requireDb(),resource,String(id)));return snapshot.exists()?normalize({id:snapshot.id,...snapshot.data()}):null;})),"데이터 불러오기");return{data:rows.filter((row):row is RaRecord=>Boolean(row)) as never};},
  async getManyReference(resource,params){const snapshot=await firebaseRequest(getDocs(query(collection(requireDb(),resource),where(params.target,"==",params.id))),"연결 데이터 불러오기");let rows=snapshot.docs.map(item=>normalize({id:item.id,...item.data()}));const filters=params.filter||{};rows=rows.filter(row=>Object.entries(filters).every(([key,value])=>!value||String(row[key]??"").toLowerCase().includes(String(value).toLowerCase())));if(params.sort?.field)rows.sort((a,b)=>String(a[params.sort.field]??"").localeCompare(String(b[params.sort.field]??""))*(params.sort.order==="DESC"?-1:1));const total=rows.length,pagination=params.pagination||{page:1,perPage:25},start=(pagination.page-1)*pagination.perPage;return{data:rows.slice(start,start+pagination.perPage) as never,total};},
  async create(resource,params){const prepared=preparePayload(resource,params.data as Record<string,unknown>);const payload=cleanPayload({...prepared,createdAt:prepared.createdAt||new Date().toISOString()});const created=await firebaseRequest(addDoc(collection(requireDb(),resource),payload),"저장");return{data:normalize({id:created.id,...payload}) as never};},
  async update(resource,params){const prepared=preparePayload(resource,params.data as Record<string,unknown>);const payload=cleanPayload({...prepared,updatedAt:new Date().toISOString()});delete payload.id;await firebaseRequest(updateWithSideEffects(resource,String(params.id),payload),"저장");return{data:normalize({id:params.id,...prepared,...payload}) as never};},
  async updateMany(resource,params){const batch=writeBatch(requireDb());params.ids.forEach(id=>batch.set(doc(requireDb(),resource,String(id)),cleanPayload({...params.data,updatedAt:new Date().toISOString()}),{merge:true}));await firebaseRequest(batch.commit(),"일괄 저장");return{data:params.ids};},
  async delete(resource,params){await firebaseRequest(deleteWithSideEffects(resource,String(params.id)),"삭제");return{data:normalize(params.previousData||{id:params.id}) as never};},
  async deleteMany(resource,params){const batch=writeBatch(requireDb());params.ids.forEach(id=>batch.delete(doc(requireDb(),resource,String(id))));await firebaseRequest(batch.commit(),"일괄 삭제");return{data:params.ids};},
};

export const firebaseAuthProvider:AuthProvider = {
  async login({username,password}){if(!auth)throw new Error("Firebase가 연결되지 않았습니다.");const credential=await signInWithEmailAndPassword(auth,username,password);userReadyPromise=Promise.resolve(credential.user);accessCache=null;await credential.user.getIdTokenResult(true);const access=await currentAdminAccess();if(!access||(!access.owner&&access.permissions.length===0)){await signOut(auth);userReadyPromise=null;accessCache=null;throw new Error("관리자 권한이 없습니다.");}},
  async logout(){accessCache=null;userReadyPromise=null;if(auth)await signOut(auth);},
  async checkAuth(){const access=await currentAdminAccess();if(!access)throw new Error("로그인이 필요합니다.");if(!access.owner&&access.permissions.length===0)throw new Error("관리자 권한이 없습니다.");},
  async checkError(){},
  async getIdentity(){const user=auth?.currentUser||await waitForUser();if(!user)throw new Error("로그인이 필요합니다.");return{id:user.uid,fullName:user.email||"관리자"};},
  async getPermissions(){const access=await currentAdminAccess();if(!access)return[];if(access.owner)return["owner"];return access.role==="deputy"?["deputy",...access.permissions]:access.permissions;},
  async canAccess({resource,action}){const access=await currentAdminAccess();if(!access)return false;if(access.owner)return true;const permissions=access.permissions;if(resource==="accountMessages")return permissions.includes("applications")||permissions.includes("events");if(resource==="products")return permissions.includes("design")||permissions.includes("shopManagers");if(resource==="shops")return permissions.includes("design")||(permissions.includes("shopManagers")&&["list","show"].includes(String(action)));if(resource==="adminNotices"&&["list","show"].includes(String(action)))return true;return permissions.includes(permissionByResource[resource]);},
};
