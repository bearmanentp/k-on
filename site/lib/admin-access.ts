import type { User } from "firebase/auth";
import { doc, Firestore, getDoc } from "firebase/firestore";

export async function readAdminAccess(user: User, firestore: Firestore) {
  const token = await user.getIdTokenResult();
  const tokenPermissions = Array.isArray(token.claims.permissions) ? token.claims.permissions.map(String) : [];
  const email = String(user.email || "").trim().toLowerCase();
  const directorySnapshot = email ? await getDoc(doc(firestore, "adminDirectory", email)) : null;
  const directory = directorySnapshot?.data() || {};
  const directoryActive = directory.active === true;
  const directoryPermissions = directoryActive && Array.isArray(directory.permissions) ? directory.permissions.map(String) : [];
  return {
    role: token.claims.role === "owner" ? "owner" : String((directoryActive && directory.role) || token.claims.role || ""),
    permissions: Array.from(new Set([...tokenPermissions, ...directoryPermissions])),
  };
}
