import {
  Auth,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { doc, Firestore, runTransaction, serverTimestamp } from "firebase/firestore";
import { resolvedPointSettings } from "@/lib/points";

export const googleProvider = new GoogleAuthProvider();

const NICKNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeNickname(value: string) {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function nicknameKey(value: string) {
  return encodeURIComponent(value.toLocaleLowerCase("ko-KR"));
}

function changedAtMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  const time = new Date(String(value || "")).getTime();
  return Number.isFinite(time) ? time : 0;
}

export async function claimNickname(firestore: Firestore, user: User, requestedNickname: string, referralCodeValue = "") {
  const nickname = normalizeNickname(requestedNickname);
  if (nickname.length < 2 || nickname.length > 20) throw new Error("닉네임은 2~20자로 입력해 주세요.");
  if (!/^[\p{L}\p{N} _.-]+$/u.test(nickname)) throw new Error("닉네임에는 한글, 영문, 숫자와 일부 기호만 사용할 수 있습니다.");
  const key = nicknameKey(nickname);
  const userRef = doc(firestore, "users", user.uid);
  const claimRef = doc(firestore, "nicknameClaims", key);
  const signupLedgerRef = doc(firestore,"pointLedger",`signup_${user.uid}`);
  const settingsRef = doc(firestore,"pointSettings","main");
  const memberCounterRef = doc(firestore,"systemCounters","members");
  const ownReferralCode = user.uid.replace(/[^a-zA-Z0-9]/g,"").slice(0,12).toUpperCase();
  const ownReferralRef = doc(firestore,"referralCodes",ownReferralCode);
  const requestedReferralCode = referralCodeValue.trim().toUpperCase();
  const requestedReferralRef = requestedReferralCode ? doc(firestore,"referralCodes",requestedReferralCode) : null;
  const referralRecordRef = doc(firestore,"referrals",user.uid);
  await runTransaction(firestore, async transaction => {
    const [profileSnapshot, claimSnapshot,signupLedgerSnapshot,settingsSnapshot,counterSnapshot,ownReferralSnapshot,requestedReferralSnapshot,referralRecordSnapshot] = await Promise.all([
      transaction.get(userRef),transaction.get(claimRef),transaction.get(signupLedgerRef),transaction.get(settingsRef),transaction.get(memberCounterRef),transaction.get(ownReferralRef),
      requestedReferralRef?transaction.get(requestedReferralRef):Promise.resolve(null),transaction.get(referralRecordRef),
    ]);
    const profile = profileSnapshot.data() || {};
    const currentKey = String(profile.nicknameKey || "");
    const isNewMember=!signupLedgerSnapshot.exists();
    const inviterUid=String(requestedReferralSnapshot?.data()?.uid||"");
    const inviterRef=inviterUid?doc(firestore,"users",inviterUid):null;
    const inviterLedgerId=`referral_${user.uid}_inviter`,inviteeLedgerId=`referral_${user.uid}_invitee`;
    const [inviterSnapshot,inviterLedgerSnapshot,inviteeLedgerSnapshot]=isNewMember&&requestedReferralRef&&inviterRef&&inviterUid!==user.uid&&!referralRecordSnapshot.exists()
      ?await Promise.all([transaction.get(inviterRef),transaction.get(doc(firestore,"pointLedger",inviterLedgerId)),transaction.get(doc(firestore,"pointLedger",inviteeLedgerId))])
      :[null,null,null];
    if (currentKey === key&&!isNewMember) return;
    const changedAt = changedAtMillis(profile.nicknameChangedAt);
    if (currentKey !== key && changedAt && Date.now() - changedAt < NICKNAME_COOLDOWN_MS) {
      const days = Math.ceil((NICKNAME_COOLDOWN_MS - (Date.now() - changedAt)) / 86_400_000);
      throw new Error(`닉네임은 변경 후 30일이 지나야 다시 변경할 수 있습니다. ${days}일 후에 시도해 주세요.`);
    }
    if (claimSnapshot.exists() && claimSnapshot.data().uid !== user.uid) throw new Error("이미 사용 중인 닉네임입니다.");
    if (currentKey&&currentKey!==key) transaction.delete(doc(firestore, "nicknameClaims", currentKey));
    transaction.set(claimRef, { uid: user.uid, nickname, key, updatedAt: serverTimestamp() });
    let balance=Math.max(0,Number(profile.points||0)),memberNumber=Number(profile.memberNumber||0),lastPointLedgerId=String(profile.lastPointLedgerId||"");
    const createdAt=new Date().toISOString();
    if(isNewMember){
      const settings=resolvedPointSettings(settingsSnapshot.data()||{}),nextMember=Math.max(0,Number(counterSnapshot.data()?.memberCount||0))+1;
      memberNumber=nextMember;
      const milestone=settings.memberMilestoneEvery>0&&nextMember%settings.memberMilestoneEvery===0?settings.milestone:0;
      const signupDelta=settings.enabled?Math.max(0,Math.floor(settings.signup+milestone)):0;
      balance+=signupDelta;lastPointLedgerId=`signup_${user.uid}`;
      transaction.set(memberCounterRef,{memberCount:nextMember,updatedAt:serverTimestamp()},{merge:true});
      transaction.set(signupLedgerRef,{userId:user.uid,userEmail:user.email||"",kind:"signup",sourceId:user.uid,memberNumber:nextMember,delta:signupDelta,balance,createdAt,createdAtServer:serverTimestamp()});
      transaction.set(doc(firestore,"pointHistory",lastPointLedgerId),{userId:user.uid,userEmail:user.email||"",kind:"signup",sourceId:user.uid,delta:signupDelta,balance,reason:milestone?`${nextMember}번째 회원 가입 보너스 포함`:"회원가입 보너스",createdAt,createdAtServer:serverTimestamp(),createdBy:user.uid});
      if(!ownReferralSnapshot.exists())transaction.set(ownReferralRef,{uid:user.uid,email:user.email||"",code:ownReferralCode,createdAt,createdAtServer:serverTimestamp()});
      if(requestedReferralRef&&inviterUid&&inviterRef&&inviterSnapshot&&inviterLedgerSnapshot&&inviteeLedgerSnapshot&&inviterUid!==user.uid&&!referralRecordSnapshot.exists()){
        if(!inviterLedgerSnapshot.exists()&&!inviteeLedgerSnapshot.exists()){
          const inviterDelta=settings.enabled?Math.max(0,Math.floor(settings.referralInviter)):0,inviteeDelta=settings.enabled?Math.max(0,Math.floor(settings.referralInvitee)):0;
          const inviterBalance=Math.max(0,Number(inviterSnapshot.data()?.points||0)+inviterDelta);balance+=inviteeDelta;lastPointLedgerId=inviteeLedgerId;
          transaction.set(referralRecordRef,{inviteeUid:user.uid,inviterUid,code:requestedReferralCode,createdAt,createdAtServer:serverTimestamp()});
          transaction.set(doc(firestore,"pointLedger",inviterLedgerId),{userId:inviterUid,userEmail:requestedReferralSnapshot?.data()?.email||"",kind:"referral_inviter",sourceId:user.uid,delta:inviterDelta,balance:inviterBalance,createdAt,createdAtServer:serverTimestamp()});
          transaction.set(doc(firestore,"pointLedger",inviteeLedgerId),{userId:user.uid,userEmail:user.email||"",kind:"referral_invitee",sourceId:inviterUid,delta:inviteeDelta,balance,createdAt,createdAtServer:serverTimestamp()});
          transaction.set(doc(firestore,"pointHistory",inviterLedgerId),{userId:inviterUid,userEmail:requestedReferralSnapshot?.data()?.email||"",kind:"referral_inviter",sourceId:user.uid,delta:inviterDelta,balance:inviterBalance,reason:"친구 초대 보너스",createdAt,createdAtServer:serverTimestamp(),createdBy:user.uid});
          transaction.set(doc(firestore,"pointHistory",inviteeLedgerId),{userId:user.uid,userEmail:user.email||"",kind:"referral_invitee",sourceId:inviterUid,delta:inviteeDelta,balance,reason:"친구 추천 가입 보너스",createdAt,createdAtServer:serverTimestamp(),createdBy:user.uid});
          transaction.set(inviterRef,{points:inviterBalance,pointsUpdatedAt:createdAt,lastPointLedgerId:inviterLedgerId},{merge:true});
        }
      }
    }
    transaction.set(userRef, {
      email: user.email || "",
      nickname,
      nicknameKey: key,
      nicknameChangedAt: serverTimestamp(),
      referralCode:String(profile.referralCode||ownReferralCode),
      ...(isNewMember?{points:balance,pointsUpdatedAt:createdAt,lastPointLedgerId,memberNumber,joinedAt:serverTimestamp()}:{}),
    }, { merge: true });
  });
  return nickname;
}

export async function registerWithEmail(auth: Auth, firestore: Firestore, email: string, password: string, nickname: string, referralCode = ""): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await claimNickname(firestore, credential.user, nickname, referralCode);
  } catch (error) {
    await credential.user.delete().catch(() => undefined);
    await signOut(auth).catch(() => undefined);
    throw error;
  }
  await sendEmailVerification(credential.user);
  await signOut(auth);
  return credential.user;
}

export async function loginWithEmail(auth: Auth, email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  if (!credential.user.emailVerified) {
    await signOut(auth);
    throw new Error("EMAIL_NOT_VERIFIED");
  }
  return credential.user;
}

export async function loginWithGoogle(auth: Auth): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export function authErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code.includes("functions/already-exists")) return code.replace(/^.*?Error:\s*/, "");
  if (code.includes("functions/failed-precondition")) return code.replace(/^.*?Error:\s*/, "");
  if (code.includes("functions/invalid-argument")) return code.replace(/^.*?Error:\s*/, "");
  if (code.includes("functions/resource-exhausted")) return code.replace(/^.*?Error:\s*/, "");
  if (code === "EMAIL_NOT_VERIFIED") return "이메일 인증을 완료한 뒤 로그인해 주세요. 가입할 때 받은 인증 메일을 확인하세요.";
  if (code.includes("auth/email-already-in-use")) return "이미 가입한 이메일입니다. 로그인해 주세요.";
  if (code.includes("auth/invalid-credential")) return "이메일 또는 비밀번호를 확인해 주세요.";
  if (code.includes("auth/unauthorized-domain")) return "현재 접속 주소가 Firebase 승인 도메인에 없습니다. Firebase Authentication → Settings → 승인된 도메인에 127.0.0.1을 추가해 주세요.";
  if (code.includes("auth/operation-not-allowed")) return "이 로그인 방식이 Firebase에서 꺼져 있습니다. Authentication → Sign-in method에서 이메일/비밀번호 또는 Google을 사용 설정해 주세요.";
  if (code.includes("auth/popup-closed-by-user")) return "Google 로그인 창을 닫았습니다.";
  if (code.includes("auth/popup-blocked")) return "브라우저가 로그인 팝업을 막았습니다. 팝업을 허용해 주세요.";
  return error instanceof Error ? error.message : "인증에 실패했습니다.";
}
