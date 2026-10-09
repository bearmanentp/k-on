import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const email = String(process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("사용법: node scripts/set-owner.mjs owner@example.com");
  process.exit(1);
}

initializeApp();
const auth = getAuth();
const user = await auth.getUserByEmail(email);
const existing = user.customClaims || {};
await auth.setCustomUserClaims(user.uid, {
  ...existing,
  role: "owner",
  permissions: ["design", "events", "notices", "applications", "users", "points"],
});

console.log(`총관리자 권한을 설정했습니다: ${email}`);
console.log("대상 계정은 반드시 로그아웃 후 다시 로그인해야 새 토큰이 발급됩니다.");
