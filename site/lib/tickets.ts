import QRCode from "qrcode";
import {
  doc,
  Firestore,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";

export type TicketReservation = {
  id: string;
  userId?: string;
  userEmail?: string;
  eventId?: string;
  eventTitle?: string;
  eventStartAt?: string;
  timeSlotId?: string;
  timeSlotLabel?: string;
  seatLabel?: string;
  ticketCode?: string;
  qrNonce?: string;
  qrIssuedAt?: string;
  qrRevealAt?: string;
  status?: string;
  amount?: number;
  checkInAt?: string;
};

export type TicketGift = {
  id: string;
  reservationId: string;
  eventId: string;
  eventTitle: string;
  fromUserId: string;
  fromEmail: string;
  recipientEmail: string;
  status: "pending" | "accepted" | "canceled";
  createdAt: string;
};

export function ticketQrPayload(ticket: TicketReservation) {
  return JSON.stringify({
    type: "KON_EVENT_TICKET",
    reservationId: ticket.id,
    eventId: ticket.eventId || "",
    ticketCode: ticket.qrNonce || ticket.ticketCode || "",
  });
}

export function parseTicketQrPayload(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.type !== "KON_EVENT_TICKET") return null;
    const reservationId = String(parsed.reservationId || "");
    const eventId = String(parsed.eventId || "");
    const ticketCode = String(parsed.ticketCode || "");
    return reservationId && eventId && ticketCode ? { reservationId, eventId, ticketCode } : null;
  } catch {
    return null;
  }
}

export function ticketQrAvailable(ticket: TicketReservation, now = Date.now()) {
  if (ticket.status === "canceled") return false;
  const revealAt = ticket.qrRevealAt ? new Date(ticket.qrRevealAt).getTime() : 0;
  return !revealAt || Number.isNaN(revealAt) || now >= revealAt;
}

export async function ticketQrDataUrl(ticket: TicketReservation) {
  return QRCode.toDataURL(ticketQrPayload(ticket), { width: 360, margin: 2, errorCorrectionLevel: "M" });
}

export async function refreshTicketQr(firestore: Firestore, user: User, ticket: TicketReservation) {
  if (ticket.userId !== user.uid) throw new Error("본인 티켓만 열 수 있습니다.");
  if (!ticketQrAvailable(ticket)) throw new Error("QR 공개 시간이 되지 않았습니다.");
  const qrNonce = crypto.randomUUID();
  const qrIssuedAt = new Date().toISOString();
  await setDoc(doc(firestore, "reservations", ticket.id), { qrNonce, qrIssuedAt }, { merge: true });
  return { ...ticket, qrNonce, qrIssuedAt };
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

export async function downloadTicketPng(ticket: TicketReservation) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 680;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("티켓 이미지를 만들 수 없습니다.");
  const gradient = context.createLinearGradient(0, 0, 1200, 680);
  gradient.addColorStop(0, "#3f292e");
  gradient.addColorStop(1, "#9b5968");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 680);
  context.fillStyle = "#fffaf4";
  context.roundRect(45, 45, 1110, 590, 34);
  context.fill();
  context.fillStyle = "#e85f7d";
  context.font = "800 25px sans-serif";
  context.fillText("K-ON! FANDOM KR · EVENT TICKET", 90, 115);
  context.fillStyle = "#3f292e";
  context.font = "900 52px sans-serif";
  context.fillText(String(ticket.eventTitle || "팬 행사").slice(0, 28), 90, 195);
  context.font = "700 29px sans-serif";
  context.fillText(ticket.timeSlotLabel || ticket.eventStartAt || "일정 확인", 90, 265);
  context.fillText(ticket.seatLabel ? `좌석 ${ticket.seatLabel}` : "일반 입장", 90, 320);
  context.font = "500 23px sans-serif";
  context.fillStyle = "#856d67";
  context.fillText(`예약자 ${ticket.userEmail || "회원"}`, 90, 390);
  context.fillText(`티켓 ${ticket.ticketCode || ticket.id}`, 90, 435);
  context.setLineDash([8, 8]);
  context.strokeStyle = "#dcc8c0";
  context.beginPath();
  context.moveTo(790, 85);
  context.lineTo(790, 595);
  context.stroke();
  context.setLineDash([]);
  if (ticketQrAvailable(ticket)) {
    const qr = await loadImage(await ticketQrDataUrl(ticket));
    context.drawImage(qr, 835, 145, 260, 260);
    context.fillStyle = "#3f292e";
    context.font = "700 20px sans-serif";
    context.fillText("입장 시 QR을 제시하세요", 845, 445);
  } else {
    context.fillStyle = "#f3e5df";
    context.roundRect(835, 145, 260, 260, 20);
    context.fill();
    context.fillStyle = "#8c6f68";
    context.font = "700 21px sans-serif";
    context.textAlign = "center";
    context.fillText("QR 공개 전", 965, 270);
    context.font = "500 17px sans-serif";
    context.fillText(ticket.qrRevealAt ? new Date(ticket.qrRevealAt).toLocaleString("ko-KR") : "행사 안내를 확인하세요", 965, 305);
    context.textAlign = "left";
  }
  const anchor = document.createElement("a");
  anchor.download = `${String(ticket.eventTitle || "event").replace(/[\\/:*?"<>|]/g, "_")}-ticket.png`;
  anchor.href = canvas.toDataURL("image/png");
  anchor.click();
}

export async function createTicketGift(firestore: Firestore, user: User, ticket: TicketReservation, recipientEmailValue: string) {
  const recipientEmail = recipientEmailValue.trim().toLowerCase();
  if (!recipientEmail || !recipientEmail.includes("@")) throw new Error("받는 사람의 가입 이메일을 입력해 주세요.");
  if (recipientEmail === String(user.email || "").toLowerCase()) throw new Error("자신에게는 선물할 수 없습니다.");
  if (ticket.status === "canceled") throw new Error("취소된 티켓은 선물할 수 없습니다.");
  await setDoc(doc(firestore, "ticketGifts", ticket.id), {
    reservationId: ticket.id,
    eventId: String(ticket.eventId || ""),
    eventTitle: String(ticket.eventTitle || "행사"),
    fromUserId: user.uid,
    fromEmail: user.email || "",
    recipientEmail,
    status: "pending",
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
  });
}

export async function acceptTicketGift(firestore: Firestore, user: User, gift: TicketGift) {
  const giftRef = doc(firestore, "ticketGifts", gift.id);
  const reservationRef = doc(firestore, "reservations", gift.reservationId);
  await runTransaction(firestore, async transaction => {
    const [giftSnapshot, reservationSnapshot] = await Promise.all([transaction.get(giftRef), transaction.get(reservationRef)]);
    if (!giftSnapshot.exists() || !reservationSnapshot.exists()) throw new Error("선물 티켓을 찾을 수 없습니다.");
    const liveGift = giftSnapshot.data();
    const reservation = reservationSnapshot.data();
    if (liveGift.status !== "pending") throw new Error("이미 처리된 선물입니다.");
    if (String(liveGift.recipientEmail || "").toLowerCase() !== String(user.email || "").toLowerCase()) throw new Error("이 선물을 받을 수 있는 계정이 아닙니다.");
    if (reservation.status === "canceled") throw new Error("취소된 티켓입니다.");
    transaction.update(reservationRef, {
      userId: user.uid,
      userEmail: user.email || "",
      giftedFromUserId: reservation.userId,
      giftedFromEmail: reservation.userEmail || "",
      giftedAt: new Date().toISOString(),
    });
    transaction.update(giftRef, { status: "accepted", acceptedAt: new Date().toISOString(), acceptedBy: user.uid });
  });
}

export async function checkInTicket(firestore: Firestore, user: User, eventId: string, rawPayload: string) {
  const payload = parseTicketQrPayload(rawPayload);
  if (!payload || payload.eventId !== eventId) throw new Error("이 행사의 티켓 QR이 아닙니다.");
  const reservationRef = doc(firestore, "reservations", payload.reservationId);
  const snapshot = await getDoc(reservationRef);
  if (!snapshot.exists()) throw new Error("예약 정보를 찾을 수 없습니다.");
  const reservation = snapshot.data();
  if (reservation.eventId !== eventId || String(reservation.qrNonce || reservation.ticketCode) !== payload.ticketCode) throw new Error("만료되었거나 유효하지 않은 티켓입니다. 티켓을 다시 열어 새 QR을 보여 주세요.");
  if (reservation.status === "canceled") throw new Error("취소된 티켓입니다.");
  if (reservation.checkInAt) throw new Error(`이미 ${new Date(reservation.checkInAt).toLocaleString("ko-KR")}에 입장 처리된 티켓입니다.`);
  await setDoc(reservationRef, { checkInAt: new Date().toISOString(), checkedInBy: user.uid, status: "completed" }, { merge: true });
  return { id: snapshot.id, ...reservation } as TicketReservation;
}
