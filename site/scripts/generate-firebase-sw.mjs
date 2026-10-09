import { readFile, writeFile } from "node:fs/promises";
const firebasePackage = JSON.parse(await readFile(new URL("../node_modules/firebase/package.json", import.meta.url), "utf8"));
const firebaseVersion = firebasePackage.version;
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const ready = Object.values(config).every(Boolean);
const source = ready ? `
importScripts("https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-messaging-compat.js");
firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || "K-ON! FANDOM KR";
  self.registration.showNotification(title, {
    body: payload.notification?.body || "새 알림이 도착했습니다.",
    icon: "/favicon.svg",
    data: { url: payload.data?.url || "/#reservations" }
  });
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
` : "self.addEventListener('notificationclick', event => event.notification.close());\n";
await writeFile(new URL("../public/firebase-messaging-sw.js", import.meta.url), source, "utf8");
