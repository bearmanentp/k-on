import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onObjectDeleted, onObjectFinalized } from "firebase-functions/v2/storage";

initializeApp();
const labels = {
  received: "예약이 접수되었습니다.",
  reviewing: "담당자가 예약을 확인하고 있습니다.",
  confirmed: "예약이 확정되었습니다.",
  completed: "행사 안내가 완료되었습니다.",
};
const allowedPermissions = ["design", "events", "notices", "applications", "users", "points"];
const storageWarningBytes = Number(process.env.STORAGE_WARNING_BYTES || 4 * 1024 ** 3);
const storageCriticalBytes = Number(process.env.STORAGE_CRITICAL_BYTES || 4.8 * 1024 ** 3);

async function updateStorageUsage(delta) {
  const firestore = getFirestore();
  const usageRef = firestore.doc("systemMetrics/storage");
  const alertRef = firestore.doc("adminAlerts/storage-capacity");
  await firestore.runTransaction(async transaction => {
    const current = (await transaction.get(usageRef)).data() || {};
    const usedBytes = Math.max(0, Number(current.usedBytes || 0) + delta);
    const status = usedBytes >= storageCriticalBytes ? "critical" : usedBytes >= storageWarningBytes ? "warning" : "normal";
    transaction.set(usageRef, { usedBytes, warningBytes: storageWarningBytes, criticalBytes: storageCriticalBytes, updatedAt: new Date().toISOString() }, { merge: true });
    transaction.set(alertRef, {
      status,
      usedBytes,
      warningBytes: storageWarningBytes,
      criticalBytes: storageCriticalBytes,
      message: status === "critical" ? "Firebase 이미지 저장공간이 한계에 가까워졌습니다. 외부 이미지 링크 사용을 권장합니다." : status === "warning" ? "Firebase 이미지 저장공간 사용량이 많습니다. 새 이미지는 외부 링크를 우선 사용해 주세요." : "저장공간 사용량이 정상 범위입니다.",
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
}

export const trackStorageUpload = onObjectFinalized(async event => {
  if (!event.data?.name?.startsWith("site/")) return;
  await updateStorageUsage(Number(event.data.size || 0));
});

export const trackStorageDelete = onObjectDeleted(async event => {
  if (!event.data?.name?.startsWith("site/")) return;
  await updateStorageUsage(-Number(event.data.size || 0));
});

export const manageAdminPermissions = onCall(async request => {
  if (!request.auth || request.auth.token.role !== "owner") {
    throw new HttpsError("permission-denied", "총관리자만 관리자 권한을 변경할 수 있습니다.");
  }
  const email = String(request.data?.email || "").trim().toLowerCase();
  const permissions = [...new Set(Array.isArray(request.data?.permissions) ? request.data.permissions : [])]
    .filter(permission => allowedPermissions.includes(permission));
  if (!email) throw new HttpsError("invalid-argument", "회원 이메일을 입력해 주세요.");

  let target;
  try {
    target = await getAuth().getUserByEmail(email);
  } catch {
    throw new HttpsError("not-found", "먼저 회원가입한 계정만 관리자로 지정할 수 있습니다.");
  }
  if (target.uid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "현재 총관리자 자신의 권한은 이 화면에서 변경할 수 없습니다.");
  }

  const existing = target.customClaims || {};
  if (existing.role === "owner") throw new HttpsError("failed-precondition", "다른 총관리자 권한은 변경할 수 없습니다.");
  const preservedClaims = { ...existing };
  delete preservedClaims.role;
  delete preservedClaims.permissions;
  const claims = permissions.length ? { ...preservedClaims, role: "manager", permissions } : preservedClaims;
  await getAuth().setCustomUserClaims(target.uid, claims);
  await getFirestore().doc(`adminDirectory/${target.uid}`).set({
    email,
    permissions,
    active: permissions.length > 0,
    updatedAt: new Date().toISOString(),
    updatedBy: request.auth.uid,
  }, { merge: true });
  return { uid: target.uid, email, permissions, active: permissions.length > 0 };
});

export const manageUserPoints = onCall(async request => {
  const permissions = Array.isArray(request.auth?.token?.permissions) ? request.auth.token.permissions : [];
  if (!request.auth || (request.auth.token.role !== "owner" && !permissions.includes("points"))) {
    throw new HttpsError("permission-denied", "포인트를 지급할 권한이 없습니다.");
  }
  const email = String(request.data?.email || "").trim().toLowerCase();
  const delta = Number(request.data?.delta);
  const reason = String(request.data?.reason || "관리자 지급").trim().slice(0, 200);
  if (!email || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) {
    throw new HttpsError("invalid-argument", "회원 이메일과 0이 아닌 정수 포인트를 입력해 주세요.");
  }
  let target;
  try {
    target = await getAuth().getUserByEmail(email);
  } catch {
    throw new HttpsError("not-found", "해당 이메일의 회원을 찾을 수 없습니다.");
  }
  const firestore = getFirestore();
  const userRef = firestore.doc(`users/${target.uid}`);
  const historyRef = firestore.collection("pointHistory").doc();
  let balance = 0;
  await firestore.runTransaction(async transaction => {
    const current = (await transaction.get(userRef)).data() || {};
    balance = Math.max(0, Number(current.points || 0) + delta);
    transaction.set(userRef, { email, points: balance, pointsUpdatedAt: new Date().toISOString() }, { merge: true });
    transaction.set(historyRef, { userId: target.uid, userEmail: email, delta, balance, reason, createdAt: new Date().toISOString(), createdBy: request.auth.uid });
  });
  return { uid: target.uid, email, delta, balance };
});

export const notifyReservationProgress = onDocumentUpdated("reservations/{reservationId}", async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || before?.status === after.status || !after.userId) return;
  await getFirestore().collection("accountMessages").add({
    userId: after.userId,
    userEmail: after.userEmail || "",
    title: after.eventTitle || "K-ON! 행사 예약",
    body: labels[after.status] || "예약 상태가 변경되었습니다.",
    kind: "reservation_status",
    reservationId: event.params.reservationId,
    createdAt: new Date().toISOString(),
    read: false,
    url: "/#events",
  });
});

export const notifyInquiryAnswer = onDocumentUpdated("inquiries/{inquiryId}", async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || before?.status === after.status || after.status !== "answered" || !after.userId) return;
  await getFirestore().collection("accountMessages").add({
    userId: after.userId,
    userEmail: after.userEmail || "",
    title: `문의 답변: ${after.title || "문의"}`,
    body: after.answer || "관리자 답변이 등록되었습니다.",
    kind: "inquiry_answer",
    inquiryId: event.params.inquiryId,
    createdAt: new Date().toISOString(),
    read: false,
    url: "/#inquiries",
  });
});

export const pushAccountMessage = onDocumentCreated("accountMessages/{messageId}", async event => {
  const message = event.data?.data();
  if (!message?.userId) return;
  const user = await getFirestore().doc(`users/${message.userId}`).get();
  const tokens = Array.isArray(user.data()?.fcmTokens) ? user.data().fcmTokens.filter(Boolean) : [];
  if (!tokens.length) return;
  const result = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: message.title || "K-ON! FANDOM KR",
      body: message.body || "새 쪽지가 도착했습니다.",
    },
    data: { url: message.url || "/", messageId: event.params.messageId },
  });
  const invalid = result.responses.flatMap((item, index) =>
    item.success ? [] : ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(item.error?.code) ? [tokens[index]] : []
  );
  if (invalid.length) await user.ref.update({ fcmTokens: tokens.filter(token => !invalid.includes(token)) });
});
