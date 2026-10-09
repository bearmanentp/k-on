import { collection, doc, Firestore, runTransaction, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";

export type PointSettings = {
  enabled?: boolean;
  signupPoints?: number;
  noticeReadPoints?: number;
  referralInviterPoints?: number;
  referralInviteePoints?: number;
  memberMilestoneEvery?: number;
  memberMilestonePoints?: number;
  purchaseUnitAmount?: number;
  purchasePointsPerUnit?: number;
  eventEnabled?: boolean;
  eventName?: string;
  eventStartAtMs?: number;
  eventEndAtMs?: number;
  eventSignupPoints?: number;
  eventNoticeReadPoints?: number;
  eventReferralInviterPoints?: number;
  eventReferralInviteePoints?: number;
  eventMemberMilestonePoints?: number;
  eventPurchaseUnitAmount?: number;
  eventPurchasePointsPerUnit?: number;
};

export const DEFAULT_POINT_SETTINGS:Required<PointSettings> = {
  enabled:true,signupPoints:100,noticeReadPoints:5,referralInviterPoints:100,referralInviteePoints:50,
  memberMilestoneEvery:100,memberMilestonePoints:500,purchaseUnitAmount:1000,purchasePointsPerUnit:10,
  eventEnabled:false,eventName:"",eventStartAtMs:0,eventEndAtMs:0,eventSignupPoints:0,eventNoticeReadPoints:0,
  eventReferralInviterPoints:0,eventReferralInviteePoints:0,eventMemberMilestonePoints:0,eventPurchaseUnitAmount:1000,eventPurchasePointsPerUnit:0,
};

export function resolvedPointSettings(value:PointSettings,now=Date.now()){
  const settings={...DEFAULT_POINT_SETTINGS,...value};
  const eventActive=settings.eventEnabled&&settings.eventStartAtMs<=now&&now<=settings.eventEndAtMs;
  return {
    ...settings,eventActive,
    signup:eventActive?settings.eventSignupPoints:settings.signupPoints,
    notice:eventActive?settings.eventNoticeReadPoints:settings.noticeReadPoints,
    referralInviter:eventActive?settings.eventReferralInviterPoints:settings.referralInviterPoints,
    referralInvitee:eventActive?settings.eventReferralInviteePoints:settings.referralInviteePoints,
    milestone:eventActive?settings.eventMemberMilestonePoints:settings.memberMilestonePoints,
    purchaseUnit:eventActive?settings.eventPurchaseUnitAmount:settings.purchaseUnitAmount,
    purchasePerUnit:eventActive?settings.eventPurchasePointsPerUnit:settings.purchasePointsPerUnit,
  };
}

export function purchaseReward(settingsValue:PointSettings,amount:number,product?:Record<string,unknown>){
  const settings=resolvedPointSettings(settingsValue);
  if(!settings.enabled)return 0;
  if(!settings.eventActive){
    if(product?.rewardMode==="none")return 0;
    if(product?.rewardMode==="fixed")return Math.max(0,Math.floor(Number(product.rewardPoints||0)));
  }
  const unit=Math.max(1,Number(settings.purchaseUnit||1000));
  return Math.max(0,Math.floor(Math.max(0,amount)/unit)*Math.max(0,Number(settings.purchasePerUnit||0)));
}

export async function awardNoticeRead(firestore:Firestore,user:User,noticeId:string,title:string){
  const ledgerId=`notice_${noticeId}_${user.uid}`,ledgerRef=doc(firestore,"pointLedger",ledgerId);
  await runTransaction(firestore,async transaction=>{
    const settingsRef=doc(firestore,"pointSettings","main"),userRef=doc(firestore,"users",user.uid),noticeRef=doc(firestore,"notices",noticeId);
    const [settingsSnapshot,userSnapshot,ledgerSnapshot,noticeSnapshot]=await Promise.all([transaction.get(settingsRef),transaction.get(userRef),transaction.get(ledgerRef),transaction.get(noticeRef)]);
    if(ledgerSnapshot.exists()||!noticeSnapshot.exists())return;
    const settings=resolvedPointSettings(settingsSnapshot.data()||{}),delta=settings.enabled?Math.max(0,Math.floor(settings.notice)):0;
    if(!delta)return;
    const balance=Math.max(0,Number(userSnapshot.data()?.points||0)+delta),createdAt=new Date().toISOString();
    transaction.set(ledgerRef,{userId:user.uid,userEmail:user.email||"",kind:"notice_read",sourceId:noticeId,delta,balance,createdAt,createdAtServer:serverTimestamp()});
    transaction.set(doc(firestore,"pointHistory",ledgerId),{userId:user.uid,userEmail:user.email||"",kind:"notice_read",sourceId:noticeId,delta,balance,reason:`공지 확인: ${title}`.slice(0,200),createdAt,createdAtServer:serverTimestamp(),createdBy:user.uid});
    transaction.set(userRef,{points:balance,pointsUpdatedAt:createdAt,lastPointLedgerId:ledgerId},{merge:true});
  });
}

export function newPointHistoryRef(firestore:Firestore,id:string){return doc(collection(firestore,"pointHistory"),id);}
