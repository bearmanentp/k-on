import { doc, DocumentData, DocumentReference, Firestore, runTransaction, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";

type SeatCell = { label?: string; kind?: string };
type ReservableEvent = {
  title?: string;
  status?: string;
  bookingType?: "general" | "assigned_seat";
  bookingOpenAt?: string;
  bookingCloseAt?: string;
  capacity?: number;
  price?: number;
  seatRows?: number;
  seatsPerRow?: number;
  blockedSeats?: string[];
  seatLayout?: { cells?: SeatCell[] };
};

export type ReservationResult = { reservationId: string; seatLabel?: string };

function cleanAnswers(value: Record<string, string>) {
  return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, answer]) => [String(key).slice(0, 80), String(answer ?? "").slice(0, 2000)]));
}

function validSeat(event: ReservableEvent, requestedSeat: string) {
  const cells = Array.isArray(event.seatLayout?.cells) ? event.seatLayout.cells : [];
  if (cells.length) return cells.some(cell => String(cell.label || "").toUpperCase() === requestedSeat && cell.kind === "seat");
  const match = requestedSeat.match(/^([A-Z])(\d+)$/);
  if (!match) return false;
  const row = match[1].charCodeAt(0) - 65;
  const column = Number(match[2]);
  const blocked = new Set((event.blockedSeats || []).map(value => String(value).toUpperCase()));
  return row >= 0 && row < Math.min(26, Math.max(0, Number(event.seatRows || 0)))
    && column >= 1 && column <= Math.max(0, Number(event.seatsPerRow || 0))
    && !blocked.has(requestedSeat);
}

export async function reserveEventInFirestore(
  firestore: Firestore,
  user: User,
  eventId: string,
  answers: Record<string, string>,
  requestedSeatValue?: string,
): Promise<ReservationResult> {
  const normalizedEventId = String(eventId || "").trim();
  if (!normalizedEventId) throw new Error("행사 정보가 올바르지 않습니다.");
  const requestedSeat = String(requestedSeatValue || "").trim().toUpperCase();
  const reservationId = `${normalizedEventId}__${user.uid}`;
  const eventRef = doc(firestore, "events", normalizedEventId);
  const reservationRef = doc(firestore, "reservations", reservationId);
  const counterRef = doc(firestore, "events", normalizedEventId, "reservationMeta", "counter");

  let confirmedSeat = "";
  await runTransaction(firestore, async transaction => {
    const [eventSnapshot, reservationSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(reservationRef),
    ]);
    if (!eventSnapshot.exists()) throw new Error("행사를 찾을 수 없습니다.");
    const event = eventSnapshot.data() as ReservableEvent;
    const existing = reservationSnapshot.data();
    if (existing && existing.status !== "canceled") throw new Error("이미 이 행사를 예약했습니다.");
    const now = Date.now();
    if (event.status !== "open") throw new Error("마감된 행사입니다.");
    if (event.bookingOpenAt && now < new Date(event.bookingOpenAt).getTime()) throw new Error("아직 예매가 시작되지 않았습니다.");
    if (event.bookingCloseAt && now > new Date(event.bookingCloseAt).getTime()) throw new Error("예매 기간이 종료되었습니다.");

    let seatRef: DocumentReference<DocumentData> | null = null;
    let counterCount = 0;
    if (event.bookingType === "assigned_seat") {
      if (!validSeat(event, requestedSeat)) throw new Error("선택할 수 없는 좌석입니다.");
      seatRef = doc(firestore, "events", normalizedEventId, "seats", requestedSeat);
      const seatSnapshot = await transaction.get(seatRef);
      if (seatSnapshot.exists()) throw new Error("방금 다른 회원이 선택한 좌석입니다. 다른 좌석을 선택해 주세요.");
      confirmedSeat = requestedSeat;
    } else {
      const counterSnapshot = await transaction.get(counterRef);
      counterCount = Math.max(0, Number(counterSnapshot.data()?.activeCount || 0));
      if (counterCount >= Math.max(1, Number(event.capacity || 1))) throw new Error("예약 정원이 마감되었습니다.");
    }

    const reservation = {
      userId: user.uid,
      userEmail: user.email || "",
      eventId: normalizedEventId,
      eventTitle: String(event.title || "행사"),
      answers: cleanAnswers(answers),
      seatLabel: confirmedSeat || null,
      bookingType: event.bookingType === "assigned_seat" ? "assigned_seat" : "general",
      amount: Math.max(0, Number(event.price || 0)),
      createdAt: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
      status: "received",
    };
    transaction.set(reservationRef, reservation);
    if (seatRef) transaction.set(seatRef, {
      eventId: normalizedEventId,
      seatLabel: confirmedSeat,
      reservationId,
      userId: user.uid,
      createdAt: reservation.createdAt,
    });
    else transaction.set(counterRef, { activeCount: counterCount + 1, updatedAt: serverTimestamp() }, { merge: true });
  });
  return { reservationId, seatLabel: confirmedSeat || undefined };
}
