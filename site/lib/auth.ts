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

export const googleProvider = new GoogleAuthProvider();

export async function registerWithEmail(auth: Auth, email: string, password: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
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
  if (code === "EMAIL_NOT_VERIFIED") return "이메일 인증을 완료한 뒤 로그인해 주세요. 가입할 때 받은 인증 메일을 확인하세요.";
  if (code.includes("auth/email-already-in-use")) return "이미 가입한 이메일입니다. 로그인해 주세요.";
  if (code.includes("auth/invalid-credential")) return "이메일 또는 비밀번호를 확인해 주세요.";
  if (code.includes("auth/unauthorized-domain")) return "현재 접속 주소가 Firebase 승인 도메인에 없습니다. Firebase Authentication → Settings → 승인된 도메인에 127.0.0.1을 추가해 주세요.";
  if (code.includes("auth/operation-not-allowed")) return "이 로그인 방식이 Firebase에서 꺼져 있습니다. Authentication → Sign-in method에서 이메일/비밀번호 또는 Google을 사용 설정해 주세요.";
  if (code.includes("auth/popup-closed-by-user")) return "Google 로그인 창을 닫았습니다.";
  if (code.includes("auth/popup-blocked")) return "브라우저가 로그인 팝업을 막았습니다. 팝업을 허용해 주세요.";
  return error instanceof Error ? error.message : "인증에 실패했습니다.";
}
