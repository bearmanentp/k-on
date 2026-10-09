import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const app = firebaseConfigured ? (getApps()[0] ?? initializeApp(firebaseConfig)) : null;
export const auth = app ? getAuth(app) : null;
function initializeSiteFirestore(){
  if(!app)return null;
  try{
    return initializeFirestore(app,{
      experimentalAutoDetectLongPolling:true,
      localCache:typeof window==="undefined"?memoryLocalCache():persistentLocalCache({tabManager:persistentMultipleTabManager()}),
    });
  }catch{
    // 개발 중 HMR로 이미 초기화된 인스턴스가 있으면 해당 인스턴스를 재사용합니다.
    return getFirestore(app);
  }
}
export const db = initializeSiteFirestore();
export const storage = app ? getStorage(app) : null;
export const functions = app ? getFunctions(app) : null;
export const messagingPromise = app
  ? isSupported().then(ok => ok ? getMessaging(app) : null)
  : Promise.resolve(null);
