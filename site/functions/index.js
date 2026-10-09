import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onObjectDeleted, onObjectFinalized } from "firebase-functions/v2/storage";

initializeApp();
const labels = {
  received: "예약이 접수되었습니다.",
  reviewing: "담당자가 예약을 확인하고 있습니다.",
  confirmed: "예약이 확정되었습니다.",
  completed: "행사 안내가 완료되었습니다.",
  canceled: "예약이 취소되었습니다.",
};
const allowedPermissions = ["design", "events", "notices", "applications", "users", "points", "shopManagers"];
const storageWarningBytes = Number(process.env.STORAGE_WARNING_BYTES || 4 * 1024 ** 3);
const storageCriticalBytes = Number(process.env.STORAGE_CRITICAL_BYTES || 4.8 * 1024 ** 3);

function canManageDesign(request) {
  return request.auth && (request.auth.token.role === "owner" || (Array.isArray(request.auth.token.permissions) && request.auth.token.permissions.includes("design")));
}

async function canManageUsers(request) {
  if (!request.auth) return false;
  if (request.auth.token.role === "owner") return true;
  if (Array.isArray(request.auth.token.permissions) && request.auth.token.permissions.includes("users")) return true;
  const firestore = getFirestore();
  const email = String(request.auth.token.email || "").trim().toLowerCase();
  const references = [firestore.doc(`adminDirectory/${request.auth.uid}`)];
  if (email) references.push(firestore.doc(`adminDirectory/${email}`));
  const snapshots = await firestore.getAll(...references);
  return snapshots.some(snapshot => {
    const entry = snapshot.data() || {};
    return entry.active === true && (entry.role === "owner" || (Array.isArray(entry.permissions) && entry.permissions.includes("users")));
  });
}

// Firebase Authentication accounts created before the Firestore member directory
// existed are backfilled when an authorized administrator opens the member list.
// Existing profile/point fields are deliberately left untouched.
export const syncAuthUsers = onCall({ timeoutSeconds: 120, memory: "256MiB" }, async request => {
  if (!await canManageUsers(request)) throw new HttpsError("permission-denied", "회원 목록을 동기화할 권한이 없습니다.");
  const firestore = getFirestore();
  let pageToken;
  let scanned = 0;
  let created = 0;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    scanned += page.users.length;
    const references = page.users.map(user => firestore.doc(`users/${user.uid}`));
    const existing = references.length ? await firestore.getAll(...references) : [];
    const missing = page.users.filter((_, index) => !existing[index].exists);
    for (let offset = 0; offset < missing.length; offset += 500) {
      const batch = firestore.batch();
      for (const user of missing.slice(offset, offset + 500)) {
        const joinedAt = user.metadata.creationTime || new Date().toISOString();
        batch.create(firestore.doc(`users/${user.uid}`), {
          email: String(user.email || "").trim().toLowerCase(),
          nickname: user.displayName || "",
          photoURL: user.photoURL || "",
          joinedAt,
          lastSignInAt: user.metadata.lastSignInTime || joinedAt,
          disabled: user.disabled,
          providers: user.providerData.map(provider => provider.providerId),
          points: 0,
          migratedFromAuth: true,
          migratedAt: new Date().toISOString(),
        });
      }
      await batch.commit();
      created += Math.min(500, missing.length - offset);
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return { scanned, created };
});

export const setImageHostingKey = onCall(async request => {
  if (!canManageDesign(request)) throw new HttpsError("permission-denied", "이미지 호스팅 설정 권한이 없습니다.");
  const apiKey = String(request.data?.apiKey || "").trim();
  if (apiKey.length < 8) throw new HttpsError("invalid-argument", "올바른 ImgBB API 키를 입력해 주세요.");
  await getFirestore().doc("privateConfig/imgbb").set({ apiKey, configuredAt: new Date().toISOString(), configuredBy: request.auth.uid });
  return { configured: true };
});

export const deleteImageHostingKey = onCall(async request => {
  if (!canManageDesign(request)) throw new HttpsError("permission-denied", "이미지 호스팅 설정 권한이 없습니다.");
  await getFirestore().doc("privateConfig/imgbb").delete();
  return { configured: false };
});

export const getImageHostingStatus = onCall(async request => {
  if (!canManageDesign(request)) throw new HttpsError("permission-denied", "이미지 호스팅 설정 권한이 없습니다.");
  const snapshot = await getFirestore().doc("privateConfig/imgbb").get();
  return { configured: snapshot.exists, configuredAt: snapshot.data()?.configuredAt || null };
});

export const uploadEditorImage = onCall({ timeoutSeconds: 30, memory: "256MiB" }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인 후 이미지를 업로드해 주세요.");
  const image = String(request.data?.image || ""), name = String(request.data?.name || "image").slice(0, 100);
  if (!image || image.length > 11_000_000) throw new HttpsError("invalid-argument", "이미지는 8MB 이하로 업로드해 주세요.");
  const config = await getFirestore().doc("privateConfig/imgbb").get();
  const apiKey = String(config.data()?.apiKey || "");
  if (!apiKey) throw new HttpsError("failed-precondition", "관리자가 이미지 호스팅 API 키를 등록하지 않았습니다.");
  const form = new FormData();
  form.append("image", image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""));
  form.append("name", name.replace(/\.[^.]+$/, ""));
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, { method: "POST", body: form, signal: AbortSignal.timeout(25000) });
  const result = await response.json();
  if (!response.ok || !result?.success || !result?.data?.url) throw new HttpsError("internal", "이미지 호스팅 업로드에 실패했습니다.");
  return { url: result.data.url, viewerUrl: result.data.url_viewer || "" };
});

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
  const callerRole = request.auth?.token?.role;
  if (!request.auth || !["owner", "deputy"].includes(callerRole)) {
    throw new HttpsError("permission-denied", "관리자 권한을 변경할 권한이 없습니다.");
  }
  const email = String(request.data?.email || "").trim().toLowerCase();
  const permissions = [...new Set(Array.isArray(request.data?.permissions) ? request.data.permissions : [])]
    .filter(permission => allowedPermissions.includes(permission));
  const requestedRole = request.data?.role === "deputy" ? "deputy" : "manager";
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
  if (existing.role === "owner" || (callerRole === "deputy" && existing.role === "deputy")) throw new HttpsError("failed-precondition", "자신보다 높은 관리자 권한은 변경할 수 없습니다.");
  if (callerRole === "deputy" && requestedRole === "deputy") throw new HttpsError("permission-denied", "부총관리자는 다른 부총관리자를 지정할 수 없습니다.");
  const preservedClaims = { ...existing };
  delete preservedClaims.role;
  delete preservedClaims.permissions;
  const claims = permissions.length ? { ...preservedClaims, role: requestedRole, permissions } : preservedClaims;
  await getAuth().setCustomUserClaims(target.uid, claims);
  await getFirestore().doc(`adminDirectory/${target.uid}`).set({
    email,
    permissions,
    role: permissions.length ? requestedRole : "member",
    active: permissions.length > 0,
    updatedAt: new Date().toISOString(),
    updatedBy: request.auth.uid,
  }, { merge: true });
  return { uid: target.uid, email, permissions, active: permissions.length > 0 };
});

const NICKNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
function normalizeNickname(value) {
  return String(value || "").trim().normalize("NFC");
}
function nicknameKey(value) {
  return normalizeNickname(value).toLocaleLowerCase("ko-KR");
}

// Nicknames are claimed in a transaction so two users cannot take the same name.
// The cooldown is enforced here (not in the client) and therefore cannot be bypassed.
export const setNickname = onCall(async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const nickname = normalizeNickname(request.data?.nickname);
  if (nickname.length < 2 || nickname.length > 20) throw new HttpsError("invalid-argument", "닉네임은 2~20자로 입력해 주세요.");
  if (!/^[\p{L}\p{N} _.-]+$/u.test(nickname)) throw new HttpsError("invalid-argument", "닉네임에는 한글, 영문, 숫자와 일부 기호만 사용할 수 있습니다.");
  const key = nicknameKey(nickname);
  const firestore = getFirestore();
  const userRef = firestore.doc(`users/${request.auth.uid}`);
  const claimRef = firestore.doc(`nicknameClaims/${key}`);
  const now = new Date();
  await firestore.runTransaction(async transaction => {
    const [userSnap, claimSnap] = await Promise.all([transaction.get(userRef), transaction.get(claimRef)]);
    const user = userSnap.data() || {};
    const currentKey = user.nicknameKey;
    const currentChangedAt = user.nicknameChangedAt?.toDate?.() || (user.nicknameChangedAt ? new Date(user.nicknameChangedAt) : null);
    if (currentKey === key) return;
    if (currentChangedAt && now.getTime() - currentChangedAt.getTime() < NICKNAME_COOLDOWN_MS) {
      const remainingDays = Math.ceil((NICKNAME_COOLDOWN_MS - (now.getTime() - currentChangedAt.getTime())) / 86400000);
      throw new HttpsError("failed-precondition", `닉네임은 변경 후 30일이 지나야 다시 변경할 수 있습니다. ${remainingDays}일 후에 시도해 주세요.`);
    }
    if (claimSnap.exists && claimSnap.data()?.uid !== request.auth.uid) throw new HttpsError("already-exists", "이미 사용 중인 닉네임입니다.");
    if (currentKey) transaction.delete(firestore.doc(`nicknameClaims/${currentKey}`));
    transaction.set(claimRef, { uid: request.auth.uid, nickname, updatedAt: now.toISOString() });
    transaction.set(userRef, { email: request.auth.token.email || user.email || "", nickname, nicknameKey: key, nicknameChangedAt: now.toISOString() }, { merge: true });
  });
  return { nickname };
});

export const releaseNicknameOnAccountDeletion = onDocumentDeleted("users/{uid}", async event => {
  const key = event.data?.data()?.nicknameKey;
  if (key) await getFirestore().doc(`nicknameClaims/${key}`).delete();
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

export const reserveEvent = onCall(async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "예약하려면 로그인이 필요합니다.");
  const eventId = String(request.data?.eventId || "").trim();
  const requestedSeat = String(request.data?.seatLabel || "").trim().toUpperCase();
  const rawAnswers = request.data?.answers;
  const answers = rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)
    ? Object.fromEntries(Object.entries(rawAnswers).slice(0, 40).map(([key, value]) => [String(key).slice(0, 80), String(value ?? "").slice(0, 2000)]))
    : {};
  if (!eventId) throw new HttpsError("invalid-argument", "행사 정보가 올바르지 않습니다.");

  const firestore = getFirestore();
  const eventRef = firestore.doc(`events/${eventId}`);
  const reservationRef = firestore.collection("reservations").doc();
  let confirmedSeat = "";
  await firestore.runTransaction(async transaction => {
    const eventSnapshot = await transaction.get(eventRef);
    if (!eventSnapshot.exists) throw new HttpsError("not-found", "행사를 찾을 수 없습니다.");
    const event = eventSnapshot.data() || {};
    const now = Date.now();
    if (event.status !== "open") throw new HttpsError("failed-precondition", "마감된 행사입니다.");
    if (event.bookingOpenAt && now < new Date(event.bookingOpenAt).getTime()) throw new HttpsError("failed-precondition", "아직 예매가 시작되지 않았습니다.");
    if (event.bookingCloseAt && now > new Date(event.bookingCloseAt).getTime()) throw new HttpsError("failed-precondition", "예매 기간이 종료되었습니다.");

    const duplicateQuery = firestore.collection("reservations").where("eventId", "==", eventId).where("userId", "==", request.auth.uid);
    const duplicateSnapshot = await transaction.get(duplicateQuery);
    if (duplicateSnapshot.docs.some(snapshot => snapshot.data()?.status !== "canceled")) throw new HttpsError("already-exists", "이미 이 행사를 예약했습니다.");

    let seatRef = null;
    if (event.bookingType === "assigned_seat") {
      const layoutCells = Array.isArray(event.seatLayout?.cells) ? event.seatLayout.cells : [];
      const configuredSeat = layoutCells.find(cell => String(cell?.label || "").toUpperCase() === requestedSeat);
      const rows = Math.min(26, Math.max(0, Number(event.seatRows || 0)));
      const columns = Math.max(0, Number(event.seatsPerRow || 0));
      const match = requestedSeat.match(/^([A-Z])(\d+)$/);
      const rowIndex = match ? match[1].charCodeAt(0) - 65 : -1;
      const column = match ? Number(match[2]) : 0;
      const blocked = Array.isArray(event.blockedSeats) ? event.blockedSeats.map(value => String(value).toUpperCase()) : [];
      const validCustomSeat = layoutCells.length > 0 && configuredSeat?.kind === "seat";
      const validLegacySeat = layoutCells.length === 0 && match && rowIndex >= 0 && rowIndex < rows && column >= 1 && column <= columns && !blocked.includes(requestedSeat);
      if (!validCustomSeat && !validLegacySeat) {
        throw new HttpsError("invalid-argument", "선택할 수 없는 좌석입니다.");
      }
      seatRef = firestore.doc(`events/${eventId}/seats/${requestedSeat}`);
      if ((await transaction.get(seatRef)).exists) throw new HttpsError("already-exists", "방금 다른 회원이 선택한 좌석입니다. 다른 좌석을 선택해 주세요.");
      confirmedSeat = requestedSeat;
    } else {
      const capacity = Math.max(1, Number(event.capacity || 1));
      const reservationsSnapshot = await transaction.get(firestore.collection("reservations").where("eventId", "==", eventId));
      const activeCount = reservationsSnapshot.docs.filter(snapshot => snapshot.data()?.status !== "canceled").length;
      if (activeCount >= capacity) throw new HttpsError("resource-exhausted", "예약 정원이 마감되었습니다.");
    }

    const createdAt = new Date().toISOString();
    const reservation = { userId: request.auth.uid, userEmail: request.auth.token.email || "", eventId, eventTitle: String(event.title || "행사"), answers, seatLabel: confirmedSeat || null, amount: Math.max(0, Number(event.price || 0)), createdAt, status: "received" };
    transaction.set(reservationRef, reservation);
    if (seatRef) transaction.set(seatRef, { eventId, seatLabel: confirmedSeat, reservationId: reservationRef.id, userId: request.auth.uid, createdAt });
  });
  return { reservationId: reservationRef.id, seatLabel: confirmedSeat || undefined };
});

export const notifyReservationProgress = onDocumentUpdated("reservations/{reservationId}", async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || before?.status === after.status || !after.userId) return;
  const firestore = getFirestore();
  if (after.status === "canceled" && after.eventId && after.seatLabel) {
    const seatRef = firestore.doc(`events/${after.eventId}/seats/${String(after.seatLabel).toUpperCase()}`);
    const seat = await seatRef.get();
    if (seat.exists && seat.data()?.reservationId === event.params.reservationId) await seatRef.delete();
  }
  await firestore.collection("accountMessages").add({
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

export const releaseReservedSeat = onDocumentDeleted("reservations/{reservationId}", async event => {
  const reservation = event.data?.data();
  if (!reservation?.eventId || !reservation?.seatLabel) return;
  const seatRef = getFirestore().doc(`events/${reservation.eventId}/seats/${String(reservation.seatLabel).toUpperCase()}`);
  const seat = await seatRef.get();
  if (seat.exists && seat.data()?.reservationId === event.params.reservationId) await seatRef.delete();
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
