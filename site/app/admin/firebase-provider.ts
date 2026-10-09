"use client";

import type { AuthProvider, DataProvider, RaRecord } from "react-admin";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

const permissionByResource:Record<string,string> = {
  notices:"notices", news:"notices", events:"events", inquiries:"applications",
  reservations:"applications", ads:"design", adminDirectory:"users", siteSettings:"design", boardDefinitions:"notices", boardPosts:"notices",
};

function requireDb(){if(!db)throw new Error("Firebase가 연결되지 않았습니다.");return db;}
function waitForUser(){return new Promise<NonNullable<typeof auth>["currentUser"]>((resolve,reject)=>{if(!auth)return reject(new Error("Firebase가 연결되지 않았습니다."));const stop=onAuthStateChanged(auth,user=>{stop();resolve(user);},reject);});}
function normalize(value:unknown):RaRecord {const record=value as RaRecord;return {...record,id:String(record.id)};}

export const firebaseDataProvider:DataProvider = {
  async getList(resource,params){
    const snapshot=await getDocs(collection(requireDb(),resource));
    let rows=snapshot.docs.map(item=>normalize({id:item.id,...item.data()}));
    const filters=params.filter||{};
    rows=rows.filter(row=>Object.entries(filters).every(([key,value])=>{if(!value)return true;const needle=String(value).toLowerCase();return key==="q"?Object.values(row).some(cell=>String(cell??"").toLowerCase().includes(needle)):String(row[key]??"").toLowerCase().includes(needle);}));
    const sort=params.sort;
    if(sort?.field)rows.sort((a,b)=>String(a[sort.field]??"").localeCompare(String(b[sort.field]??""))*(sort.order==="DESC"?-1:1));
    const total=rows.length;
    const pagination=params.pagination||{page:1,perPage:25};
    const start=(pagination.page-1)*pagination.perPage;
    return {data:rows.slice(start,start+pagination.perPage) as never,total};
  },
  async getOne(resource,params){const snapshot=await getDoc(doc(requireDb(),resource,String(params.id)));if(!snapshot.exists())throw new Error("데이터를 찾을 수 없습니다.");return{data:normalize({id:snapshot.id,...snapshot.data()}) as never};},
  async getMany(resource,params){const rows=await Promise.all(params.ids.map(async id=>{const snapshot=await getDoc(doc(requireDb(),resource,String(id)));return snapshot.exists()?normalize({id:snapshot.id,...snapshot.data()}):null;}));return{data:rows.filter((row):row is RaRecord=>Boolean(row)) as never};},
  async getManyReference(resource,params){const snapshot=await getDocs(collection(requireDb(),resource));const rows=snapshot.docs.map(item=>normalize({id:item.id,...item.data()})).filter(row=>String(row[params.target])===String(params.id));return{data:rows as never,total:rows.length};},
  async create(resource,params){const payload={...params.data,createdAt:params.data.createdAt||new Date().toISOString()};const created=await addDoc(collection(requireDb(),resource),payload);return{data:normalize({id:created.id,...payload}) as never};},
  async update(resource,params){const payload:Record<string,unknown>={...params.data,updatedAt:new Date().toISOString()};delete payload.id;await setDoc(doc(requireDb(),resource,String(params.id)),payload,{merge:true});return{data:normalize({id:params.id,...params.data,...payload}) as never};},
  async updateMany(resource,params){const batch=writeBatch(requireDb());params.ids.forEach(id=>batch.set(doc(requireDb(),resource,String(id)),{...params.data,updatedAt:new Date().toISOString()},{merge:true}));await batch.commit();return{data:params.ids};},
  async delete(resource,params){await deleteDoc(doc(requireDb(),resource,String(params.id)));return{data:normalize(params.previousData||{id:params.id}) as never};},
  async deleteMany(resource,params){const batch=writeBatch(requireDb());params.ids.forEach(id=>batch.delete(doc(requireDb(),resource,String(id))));await batch.commit();return{data:params.ids};},
};

export const firebaseAuthProvider:AuthProvider = {
  async login({username,password}){if(!auth)throw new Error("Firebase가 연결되지 않았습니다.");const credential=await signInWithEmailAndPassword(auth,username,password);const token=await credential.user.getIdTokenResult(true);if(token.claims.role!=="owner"&&!Array.isArray(token.claims.permissions)){await signOut(auth);throw new Error("관리자 권한이 없습니다.");}},
  async logout(){if(auth)await signOut(auth);},
  async checkAuth(){const user=auth?.currentUser||await waitForUser();if(!user)throw new Error("로그인이 필요합니다.");const token=await user.getIdTokenResult();if(token.claims.role!=="owner"&&!Array.isArray(token.claims.permissions))throw new Error("관리자 권한이 없습니다.");},
  async checkError(){},
  async getIdentity(){const user=auth?.currentUser||await waitForUser();if(!user)throw new Error("로그인이 필요합니다.");return{id:user.uid,fullName:user.email||"관리자"};},
  async getPermissions(){const user=auth?.currentUser||await waitForUser();if(!user)return[];const token=await user.getIdTokenResult();if(token.claims.role==="owner")return["owner"];const permissions=Array.isArray(token.claims.permissions)?token.claims.permissions:[];return token.claims.role==="deputy"?["deputy",...permissions]:permissions;},
  async canAccess({resource}){const user=auth?.currentUser||await waitForUser();if(!user)return false;const token=await user.getIdTokenResult();if(token.claims.role==="owner")return true;const permissions=Array.isArray(token.claims.permissions)?token.claims.permissions:[];return permissions.includes(permissionByResource[resource]);},
};
