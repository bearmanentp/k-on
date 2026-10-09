import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
const [uid, role = "manager", permissionList = ""] = process.argv.slice(2);
const allowed = new Set(["design", "events", "notices", "applications", "users"]);
if (!uid) { console.error("사용법: node scripts/set-admin-claims.mjs <uid> <owner|manager> <권한목록>"); process.exit(1); }
const permissions = permissionList.split(",").map(v => v.trim()).filter(v => allowed.has(v));
initializeApp({ credential: applicationDefault() });
await getAuth().setCustomUserClaims(uid, { role, permissions: role === "owner" ? [...allowed] : permissions });
console.log("관리자 권한 적용 완료");
