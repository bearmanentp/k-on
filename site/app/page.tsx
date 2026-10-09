"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  deleteUser,
  onAuthStateChanged,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { getToken } from "firebase/messaging";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  HomeIcon,
  Info,
  LogOut,
  Mail,
  Megaphone,
  MessageSquareText,
  Music2,
  Newspaper,
  Settings,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import {
  auth,
  db,
  firebaseConfigured,
  messagingPromise,
} from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteHub } from "@/components/site/site-hub";
import { BOARD_DEFINITIONS } from "@/lib/board-config";
import { AccountMenu } from "@/app/components/account-menu";
import { FormRichTextEditor } from "@/app/components/form-rich-text-editor";
import {
  authErrorMessage,
  claimNickname,
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
} from "@/lib/auth";
import { reserveEventInFirestore } from "@/lib/reservations";
import { readAdminAccess } from "@/lib/admin-access";
import { DEFAULT_CHARACTER_IMAGES, DEFAULT_K_ON_LOGO } from "@/lib/site-defaults";

type Permission =
  | "design"
  | "events"
  | "notices"
  | "applications"
  | "users"
  | "points";
type FieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox";
type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
};
type EventItem = {
  id: string;
  title: string;
  date: string;
  place: string;
  summary: string;
  capacity: number;
  status: "open" | "closed";
  formSchema: FormField[];
  bookingType?: "general" | "assigned_seat";
  price?: number;
  seatRows?: number;
  seatsPerRow?: number;
};
type Post = {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  pinned?: boolean;
};
type Inquiry = {
  id: string;
  userId: string;
  userEmail: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  status: "waiting" | "answered";
  answer?: string;
};
type Reservation = {
  id: string;
  userId: string;
  userEmail: string;
  eventId: string;
  eventTitle: string;
  answers: Record<string, string>;
  createdAt: string;
  status: "received" | "reviewing" | "confirmed" | "completed";
};
type AdminNotice = {
  id: string;
  title: string;
  body: string;
  audiences: string[];
  createdAt: string;
};
type AccountMessage = {
  id: string;
  userId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  kind: string;
  url?: string;
};
type ManualAd = {
  id: string;
  label: string;
  title: string;
  body: string;
  imageUrl?: string;
  href?: string;
  slot: "after-hub" | "after-community";
  active: boolean;
  createdAt: string;
};
type CharacterImage = { name: string; url: string; source?: string };
type SiteSettings = {
  siteName: string;
  logoUrl: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  heroImages: string[];
  accentColor: string;
  communityMessage: string;
  characterImages: CharacterImage[];
  fontFamily: string;
};

const defaults: SiteSettings = {
  siteName: "K-ON! FANDOM KR",
  logoUrl: DEFAULT_K_ON_LOGO,
  heroEyebrow: "AFTER SCHOOL, TOGETHER",
  heroTitle: "좋아하는 음악으로\n다시 만나는 우리",
  heroDescription:
    "K-ON!의 음악과 일상을 함께 기억하고 새로운 순간을 만드는 한국 팬 커뮤니티.",
  heroImages: ["/hero-music-room.png"],
  accentColor: "#ff4f6d",
  communityMessage: "좋아하는 마음은 시간이 지나도 계속 연주됩니다.",
  characterImages: DEFAULT_CHARACTER_IMAGES,
  fontFamily: '"Pretendard", "Noto Sans KR", system-ui, sans-serif',
};
const statusLabel: Record<string, string> = {
  received: "접수",
  reviewing: "검토 중",
  confirmed: "확정",
  completed: "안내 완료",
  waiting: "답변 대기",
  answered: "답변 완료",
};

function directImageUrl(value: string) {
  const match =
    value.match(/drive\.google\.com\/file\/d\/([^/]+)/) ||
    value.match(/[?&]id=([^&]+)/);
  return match
    ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w2000`
    : value.trim();
}
function sortCreated<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function parseSchema(text: string): FormField[] {
  return text
    .split("\n")
    .map((line, index) => {
      const [label, type = "text", required = "required", options = ""] = line
        .split("|")
        .map((v) => v.trim());
      return {
        id: `q${index + 1}`,
        label,
        type: type as FieldType,
        required: required !== "optional",
        options: options
          ? options
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : undefined,
      };
    })
    .filter((x) => x.label);
}

export default function Home() {
  const [site, setSite] = useState(defaults),
    [events, setEvents] = useState<EventItem[]>([]),
    [notices, setNotices] = useState<Post[]>([]),
    [news, setNews] = useState<Post[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]),
    [reservations, setReservations] = useState<Reservation[]>([]),
    [adminNotices, setAdminNotices] = useState<AdminNotice[]>([]),
    [messages, setMessages] = useState<AccountMessage[]>([]),
    [ads, setAds] = useState<ManualAd[]>([]);
  const [user, setUser] = useState<User | null>(null),
    [role, setRole] = useState(""),
    [permissions, setPermissions] = useState<Permission[]>([]),
    [points, setPoints] = useState(0);
  const [slide, setSlide] = useState(0),
    [authOpen, setAuthOpen] = useState(false),
    [authMode, setAuthMode] = useState<"login" | "register">("login"),
    [adminOpen, setAdminOpen] = useState(false),
    [inboxOpen, setInboxOpen] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [nickname, setNickname] = useState(""),
    [authNotice, setAuthNotice] = useState(""),
    [termsAccepted, setTermsAccepted] = useState(false),
    [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [reserveEvent, setReserveEvent] = useState<EventItem | null>(null),
    [activeInquiry, setActiveInquiry] = useState<Inquiry | null>(null),
    [toast, setToast] = useState("");
  const isOwner = role === "owner";
  const can = (p: Permission) => isOwner || permissions.includes(p);
  const isAdmin = isOwner || permissions.length > 0;
  const heroImages = (
    site.heroImages?.length ? site.heroImages : [defaults.heroImages[0]]
  ).filter(Boolean);

  const currentSlide = slide % heroImages.length;
  useEffect(() => {
    if (heroImages.length < 2) return;
    const id = setInterval(
      () => setSlide((v) => (v + 1) % heroImages.length),
      6500,
    );
    return () => clearInterval(id);
  }, [heroImages.length]);
  useEffect(() => {
    if (!firebaseConfigured || !auth || !db) return;
    const firestore = db;
    const ua = onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (!next) setMessages([]);
      const access = next ? await readAdminAccess(next, firestore) : null;
      setRole(access?.role || "");
      setPermissions((access?.permissions || []) as Permission[]);
    });
    const us = onSnapshot(
      doc(db, "siteSettings", "main"),
      (s) => {
        if (!s.exists()) return;
        const saved = s.data();
        setSite({
          ...defaults,
          ...saved,
          logoUrl: String(saved.logoUrl || DEFAULT_K_ON_LOGO),
          characterImages: Array.isArray(saved.characterImages) && saved.characterImages.length
            ? saved.characterImages
            : DEFAULT_CHARACTER_IMAGES,
        } as SiteSettings);
      },
    );
    const ue = onSnapshot(
      query(collection(db, "events"), orderBy("date", "asc")),
      (s) =>
        setEvents(s.docs.map((d) => ({ id: d.id, ...d.data() }) as EventItem)),
    );
    const un = onSnapshot(
      query(collection(db, "notices"), orderBy("createdAt", "desc")),
      (s) => setNotices(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Post)),
    );
    const uw = onSnapshot(
      query(collection(db, "news"), orderBy("createdAt", "desc")),
      (s) => setNews(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Post)),
    );
    const uad = onSnapshot(
      query(collection(db, "ads"), orderBy("createdAt", "desc")),
      (s) =>
        setAds(
          s.docs
            .map((d) => ({ id: d.id, ...d.data() }) as ManualAd)
            .filter((ad) => ad.active),
        ),
    );
    return () => {
      ua();
      us();
      ue();
      un();
      uw();
      uad();
    };
  }, []);
  useEffect(() => {
    if (!db || !user) return;
    const admin = isOwner || permissions.includes("applications");
    const iq = admin
      ? collection(db, "inquiries")
      : query(collection(db, "inquiries"), where("userId", "==", user.uid));
    const rq = admin
      ? collection(db, "reservations")
      : query(collection(db, "reservations"), where("userId", "==", user.uid));
    const ui = onSnapshot(iq, (s) =>
      setInquiries(
        sortCreated(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Inquiry)),
      ),
    );
    const ur = onSnapshot(rq, (s) =>
      setReservations(
        sortCreated(
          s.docs.map((d) => ({ id: d.id, ...d.data() }) as Reservation),
        ),
      ),
    );
    return () => {
      ui();
      ur();
    };
  }, [user, isOwner, permissions]);
  useEffect(() => {
    if (!db || !user) return;
    return onSnapshot(doc(db, "users", user.uid), (snapshot) =>
      setPoints(Number(snapshot.data()?.points || 0)),
    );
  }, [user]);
  useEffect(() => {
    if (!db || !user) return;
    return onSnapshot(doc(db, "users", user.uid), (snapshot) =>
      setNickname(String(snapshot.data()?.nickname || user.displayName || "")),
    );
  }, [user]);
  useEffect(() => {
    if (!db || !user) return;
    const source = query(
      collection(db, "accountMessages"),
      where("userId", "==", user.uid),
    );
    return onSnapshot(source, (s) =>
      setMessages(
        sortCreated(
          s.docs.map((d) => ({ id: d.id, ...d.data() }) as AccountMessage),
        ),
      ),
    );
  }, [user]);
  useEffect(() => {
    if (!db || !user || (!role && !permissions.length)) return;
    const allowed = ["all", role, ...permissions].filter(Boolean);
    const source = isOwner
      ? collection(db, "adminNotices")
      : query(
          collection(db, "adminNotices"),
          where("audiences", "array-contains-any", allowed),
        );
    return onSnapshot(source, (s) =>
      setAdminNotices(
        sortCreated(
          s.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminNotice),
        ),
      ),
    );
  }, [user, role, permissions, isOwner]);

  const openEvents = useMemo(
    () => events.filter((x) => x.status === "open"),
    [events],
  );
  async function memberAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!auth) return setToast("Firebase 연결 후 로그인할 수 있습니다.");
    const f = new FormData(e.currentTarget);
    try {
      if (authMode === "register") {
        if (!db)
          return setToast("Firebase 데이터베이스 연결 후 회원가입할 수 있습니다.");
        if (f.get("terms") !== "on" || f.get("privacy") !== "on")
          return setAuthNotice(
            "이용약관과 개인정보 처리방침에 모두 동의해 주세요.",
          );
        const requestedNickname = String(
          f.get("nickname") ||
            window.prompt("가입에 사용할 닉네임을 입력해 주세요.") ||
            "",
        ).trim();
        if (!requestedNickname) return setAuthNotice("닉네임을 입력해 주세요.");
        await registerWithEmail(
          auth,
          db,
          String(f.get("email")),
          String(f.get("password")),
          requestedNickname,
          String(f.get("referralCode") || ""),
        );
        setAuthOpen(false);
        setToast("인증 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.");
      } else {
        await loginWithEmail(
          auth,
          String(f.get("email")),
          String(f.get("password")),
        );
        setAuthOpen(false);
        setToast("로그인했습니다.");
      }
    } catch (error) {
      setAuthNotice("");
      setToast(authErrorMessage(error));
    }
  }
  async function googleAuth() {
    if (!auth) return setToast("Firebase 연결 후 로그인할 수 있습니다.");
    if (!termsAccepted || !privacyAccepted)
      return setAuthNotice(
        "Google 로그인·가입 전에도 이용약관과 개인정보 처리방침에 동의해 주세요.",
      );
    try {
      const googleUser = await loginWithGoogle(auth);
      const profile = db
        ? await getDoc(doc(db, "users", googleUser.uid))
        : null;
      if (!profile?.data()?.nickname) {
        setAuthOpen(false);
        setProfileOpen(true);
        setToast("가입을 완료하려면 닉네임을 설정해 주세요.");
      } else {
        setAuthOpen(false);
        setToast("Google 계정으로 로그인했습니다.");
      }
    } catch (error) {
      setToast(authErrorMessage(error));
    }
  }
  async function enableNotifications() {
    if (!user || !db) return setAuthOpen(true);
    const messaging = await messagingPromise;
    if (!messaging)
      return setToast("이 브라우저에서는 알림을 사용할 수 없습니다.");
    if ((await Notification.requestPermission()) !== "granted")
      return setToast("알림 권한이 허용되지 않았습니다.");
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (token) {
      await setDoc(
        doc(db, "users", user.uid),
        { email: user.email, fcmTokens: arrayUnion(token) },
        { merge: true },
      );
      setToast("예약 상태 알림을 켰습니다.");
    }
  }
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !db) return;
    const value = String(
      new FormData(e.currentTarget).get("nickname") || "",
    ).trim();
    try {
      await claimNickname(db, user, value, String(new FormData(e.currentTarget).get("referralCode") || ""));
      await updateProfile(user, { displayName: value });
      setNickname(value);
      setProfileOpen(false);
      setToast("닉네임을 저장했습니다.");
    } catch (error) {
      setToast(authErrorMessage(error));
    }
  }
  async function withdrawAccount() {
    if (!user || !db || !auth) return;
    if (
      !window.confirm(
        "정말 회원 탈퇴하시겠습니까? 로그인 계정이 삭제되며 되돌릴 수 없습니다.",
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);
      setProfileOpen(false);
      setToast("회원 탈퇴가 완료되었습니다.");
    } catch (error) {
      setToast(
        error instanceof Error &&
          error.message.includes("requires-recent-login")
          ? "보안을 위해 다시 로그인한 뒤 탈퇴해 주세요."
          : "회원 탈퇴에 실패했습니다.",
      );
    }
  }
  async function saveSite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !can("design")) return;
    const f = new FormData(e.currentTarget);
    const urls = String(f.get("heroImages"))
      .split("\n")
      .map(directImageUrl)
      .filter(Boolean);
    const logo = directImageUrl(String(f.get("logoUrl"))) || DEFAULT_K_ON_LOGO;
    const parsedCharacterImages = String(f.get("characterImages"))
      .split("\n")
      .map((line) => {
        const [name, url, source] = line.split("|").map((v) => v.trim());
        return { name, url: directImageUrl(url || ""), source };
      })
      .filter((x) => x.name && x.url);
    const characterImages = parsedCharacterImages.length
      ? parsedCharacterImages
      : (site.characterImages.length ? site.characterImages : DEFAULT_CHARACTER_IMAGES);
    const hero = urls;
    if (!hero.length) return setToast("히어로 이미지는 최소 1장이 필요합니다.");
    await setDoc(
      doc(db, "siteSettings", "main"),
      {
        siteName: String(f.get("siteName")),
        logoUrl: logo,
        heroEyebrow: String(f.get("heroEyebrow")),
        heroTitle: String(f.get("heroTitle")),
        heroDescription: String(f.get("heroDescription")),
        heroImages: hero,
        accentColor: String(f.get("accentColor")),
        communityMessage: String(f.get("communityMessage")),
        characterImages,
        fontFamily: String(f.get("fontFamily") || defaults.fontFamily),
      },
      { merge: true },
    );
    setToast("사이트 디자인을 저장했습니다.");
  }
  async function createEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !can("events")) return;
    const f = new FormData(e.currentTarget);
    const schemaFile = f.get("schemaFile") as File;
    let formSchema: FormField[] = [];
    try {
      formSchema = schemaFile?.size
        ? JSON.parse(await schemaFile.text())
        : parseSchema(String(f.get("schema")));
    } catch {
      return setToast("질문 JSON 형식을 확인해 주세요.");
    }
    if (!formSchema.length)
      return setToast("신청 질문을 한 개 이상 등록해 주세요.");
    await addDoc(collection(db, "events"), {
      title: String(f.get("title")),
      date: String(f.get("date")),
      place: String(f.get("place")),
      summary: String(f.get("summary")),
      capacity: Number(f.get("capacity")),
      bookingType: "general",
      status: "open",
      formSchema,
      createdAt: new Date().toISOString(),
    });
    e.currentTarget.reset();
    setToast("행사와 신청폼을 등록했습니다.");
  }
  async function reserve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user)
      return (
        setReserveEvent(null),
        setAuthOpen(true),
        setToast("예약하려면 로그인해 주세요.")
      );
    if (!db || !reserveEvent) return;
    const f = new FormData(e.currentTarget);
    const answers = Object.fromEntries(
      reserveEvent.formSchema.map((q) => [q.id, String(f.get(q.id) || "")]),
    );
    try {
      await reserveEventInFirestore(db, user, reserveEvent.id, answers);
      setReserveEvent(null);
      setToast("예약이 접수되었습니다. 알림을 켜면 진행 상태를 받을 수 있습니다.");
    } catch (error) {
      setToast(authErrorMessage(error));
    }
  }
  async function createPost(
    e: FormEvent<HTMLFormElement>,
    kind: "notices" | "news",
  ) {
    e.preventDefault();
    if (!db || !can("notices")) return;
    const f = new FormData(e.currentTarget);
    const bodyRich=String(f.get("bodyRich")||"");
    if(!String(f.get("body")||"").trim())return setToast("본문 내용을 입력해 주세요.");
    await addDoc(collection(db, kind), {
      title: String(f.get("title")),
      body: String(f.get("body")),
      bodyRich:bodyRich?JSON.parse(bodyRich):null,
      attachmentName:String(f.get("attachmentName")||""),
      attachmentUrl:String(f.get("attachmentUrl")||""),
      category: String(f.get("category")),
      pinned: f.get("pinned") === "on",
      createdAt: new Date().toISOString(),
    });
    e.currentTarget.reset();
    setToast(kind === "news" ? "소식을 게시했습니다." : "공지를 게시했습니다.");
  }
  async function answerInquiry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !activeInquiry || !can("applications")) return;
    const f = new FormData(e.currentTarget);
    await updateDoc(doc(db, "inquiries", activeInquiry.id), {
      answer: String(f.get("answer")),
      status: "answered",
      answeredAt: new Date().toISOString(),
    });
    setActiveInquiry(null);
    setToast("답변을 등록했습니다.");
  }
  async function advanceReservation(item: Reservation) {
    if (!db || !(can("events") || can("applications"))) return;
    const order = ["received", "reviewing", "confirmed", "completed"];
    const next =
      order[Math.min(order.indexOf(item.status) + 1, order.length - 1)];
    await updateDoc(doc(db, "reservations", item.id), {
      status: next,
      updatedAt: new Date().toISOString(),
    });
    setToast(
      "예약 상태를 다음 단계로 변경했습니다. 알림이 백그라운드로 전송됩니다.",
    );
  }
  async function createAdminNotice(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !can("users")) return;
    const f = new FormData(e.currentTarget);
    const bodyRich=String(f.get("bodyRich")||"");
    if(!String(f.get("body")||"").trim())return setToast("공지 내용을 입력해 주세요.");
    await addDoc(collection(db, "adminNotices"), {
      title: String(f.get("title")),
      body: String(f.get("body")),
      bodyRich:bodyRich?JSON.parse(bodyRich):null,
      audiences: [String(f.get("audience"))],
      createdAt: new Date().toISOString(),
    });
    e.currentTarget.reset();
    setToast("관리자 공지를 게시했습니다.");
  }
  async function sendAccountMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !(can("events") || can("applications"))) return;
    const f = new FormData(e.currentTarget);
    const userId = String(f.get("userId"));
    const recipient = reservations.find((r) => r.userId === userId);
    await addDoc(collection(db, "accountMessages"), {
      userId,
      userEmail: recipient?.userEmail || "",
      title: String(f.get("title")),
      body: String(f.get("body")),
      kind: "admin_message",
      createdAt: new Date().toISOString(),
      read: false,
      url: "/#events",
      createdBy: user?.uid,
    });
    e.currentTarget.reset();
    setToast("신청자 계정으로 쪽지를 보냈습니다.");
  }
  async function manageAdmin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !user || !isOwner) return;
    const form = new FormData(e.currentTarget);
    const permissions = form.getAll("permissions").map(String) as Permission[];
    try {
      const email = String(form.get("email") || "").trim().toLowerCase();
      if (!email) return setToast("관리자 이메일을 입력해 주세요.");
      const target = doc(db, "adminDirectory", email);
      if (permissions.length) await setDoc(target, {
        email,
        role: "manager",
        permissions,
        active: true,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
      }, { merge: true });
      else await deleteDoc(target);
      setToast(
        permissions.length
          ? "관리자 권한을 저장했습니다. 대상자는 다시 로그인하면 적용됩니다."
          : "관리자 권한을 모두 해제했습니다.",
      );
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "권한 변경에 실패했습니다.",
      );
    }
  }
  async function openMessage(message: AccountMessage) {
    if (db && !message.read)
      await updateDoc(doc(db, "accountMessages", message.id), {
        read: true,
        readAt: new Date().toISOString(),
      });
    setInboxOpen(false);
    const target = message.url?.split("#")[1];
    if (target)
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
  }
  function field(q: FormField) {
    if (q.type === "textarea")
      return <Textarea name={q.id} required={q.required} />;
    if (q.type === "select")
      return (
        <select name={q.id} required={q.required}>
          <option value="">선택해 주세요</option>
          {q.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    if (q.type === "radio")
      return (
        <div className="choice-row">
          {q.options?.map((o) => (
            <label key={o}>
              <input type="radio" name={q.id} value={o} required={q.required} />
              {o}
            </label>
          ))}
        </div>
      );
    if (q.type === "checkbox")
      return (
        <label className="check-line">
          <input type="checkbox" name={q.id} required={q.required} />
          {q.label}
        </label>
      );
    return <Input name={q.id} type={q.type} required={q.required} />;
  }

  return (
    <main
      style={
        {
          "--accent": site.accentColor,
          "--site-font": site.fontFamily,
        } as CSSProperties
      }
    >
      <header className="site-header">
        <a href="#top" className="brand">
          <Image
            src={site.logoUrl}
            alt="K-ON!"
            width={124}
            height={44}
            unoptimized
          />
          <span>{site.siteName}</span>
        </a>
        <nav className="desktop-nav">
          <a href="#top">홈</a>
          <a href="#about">소개</a>
          <a href="#site-map">둘러보기</a>
          <a href="#characters">캐릭터</a>
          <Link href="/events">행사·예약</Link>
          <Link href="/shop">상점</Link>
          <details className="nav-dropdown">
            <summary>커뮤니티</summary>
            <div>
              {BOARD_DEFINITIONS.map(({ key, menuLabel, icon: Icon }) => (
                <a href={`/boards#${key}`} key={key}>
                  <Icon />
                  {menuLabel}
                </a>
              ))}
            </div>
          </details>
        </nav>
        <details className="mobile-nav">
          <summary aria-label="전체 메뉴 열기">
            <span className="toggler-icon" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="sr-menu-label">메뉴</span>
          </summary>
          <div>
            <a href="#top">
              <HomeIcon />홈
            </a>
            <a href="#about">
              <Info />
              소개
            </a>
            <a href="#site-map">
              <Sparkles />
              둘러보기
            </a>
            <a href="#characters">
              <Users />
              캐릭터
            </a>
            <Link href="/events">
              <CalendarDays />
              행사·예약
            </Link>
            <Link href="/shop">
              <Music2 />
              상점
            </Link>
            <details className="mobile-community">
              <summary>
                <Newspaper />
                커뮤니티
              </summary>
              <div>
                {BOARD_DEFINITIONS.map(({ key, menuLabel, icon: Icon }) => (
                  <a href={`/boards#${key}`} key={key}>
                    <Icon />
                    {menuLabel}
                  </a>
                ))}
              </div>
            </details>
          </div>
        </details>
        <div className="header-actions">
          {user && (
            <Button
              className="inbox-button"
              variant="ghost"
              onClick={() => setInboxOpen(true)}
            >
              <Bell />
              알림함
              {messages.some((m) => !m.read) && (
                <span className="unread-badge">
                  {messages.filter((m) => !m.read).length}
                </span>
              )}
            </Button>
          )}
          <AccountMenu onLogin={()=>setAuthOpen(true)} onSettings={()=>setProfileOpen(true)}/>
        </div>
      </header>
      {!firebaseConfigured && (
        <div className="setup-banner">
          미리보기 모드 · Firebase 연결 후 로그인, 게시판, 예약과 알림이
          활성화됩니다.
        </div>
      )}
      {toast && (
        <button className="toast" onClick={() => setToast("")}>
          {toast}
        </button>
      )}
      <section id="top" className="hero">
        {heroImages.map((image, index) => (
          <div
            key={image}
            className={`hero-slide ${index === currentSlide ? "active" : ""}`}
            style={{
              backgroundImage: `linear-gradient(90deg,rgba(8,10,18,.9),rgba(8,10,18,.48) 55%,rgba(8,10,18,.08)),url("${image}")`,
            }}
          />
        ))}
        <div className="hero-content">
          <p className="eyebrow">
            <Sparkles />
            {site.heroEyebrow}
          </p>
          <h1>
            {site.heroTitle.split("\n").map((x) => (
              <span key={x}>{x}</span>
            ))}
          </h1>
          <p>{site.heroDescription}</p>
          <div className="hero-actions">
            <Button size="lg" asChild>
              <Link href="/events">행사 예약하기</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/boards#news">새 소식 보기</Link>
            </Button>
          </div>
        </div>
        <aside className="hero-tea-card" aria-label="티타임 안내">
          <div className="hero-tea-card-top">
            <span>AFTER SCHOOL TEA</span>
            <Music2 />
          </div>
          <strong>
            잠깐 쉬어가며
            <br />
            좋아하는 이야기를 나눠요
          </strong>
          <p>오늘의 추천곡과 팬들의 새 소식을 확인해 보세요.</p>
          <Link href="/boards#news">
            <Newspaper />커뮤니티 라운지 입장
          </Link>
        </aside>
        {heroImages.length > 1 && (
          <div className="slider-control">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setSlide(
                  (currentSlide - 1 + heroImages.length) % heroImages.length,
                )
              }
            >
              <ChevronLeft />
            </Button>
            <span>
              {String(currentSlide + 1).padStart(2, "0")} /{" "}
              {String(heroImages.length).padStart(2, "0")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSlide((currentSlide + 1) % heroImages.length)}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </section>
      <section id="about" className="intro-section">
        <div>
          <small>ABOUT OUR FANDOM</small>
          <h2>
            방과 후의 설렘을
            <br />
            함께 이어가는 공간
          </h2>
        </div>
        <div>
          <p>
            K-ON! FANDOM KR은 작품과 음악을 좋아하는 팬들이 소식과 추억을
            나누고, 새로운 만남을 만드는 비영리 팬 커뮤니티입니다.
          </p>
          <p>
            공지 확인부터 팬 행사 예약, 회원 문의와 개인 알림까지 한 계정으로
            편리하게 이용할 수 있습니다.
          </p>
          <a className="board-link-button" href="/boards#news">
            <Newspaper />
            게시판 둘러보기
          </a>
        </div>
      </section>
      <SiteHub
        isAdmin={isAdmin}
        unreadCount={messages.filter((m) => !m.read).length}
        points={points}
      />
      <ManualAdSlot ads={ads} slot="after-hub" />
      <section id="characters" className="character-section">
        <div className="section-head compact">
          <div>
            <small>HO-KAGO TEA TIME</small>
            <h2>다섯 개의 개성, 하나의 사운드</h2>
          </div>
        </div>
        <div className="character-grid">
          {site.characterImages.map((c, i) => (
            <figure key={c.name} className={`character-card c${i + 1}`}>
              <Image
                src={c.url}
                alt={c.name}
                width={360}
                height={420}
                unoptimized
              />
              <figcaption>
                <span>0{i + 1}</span>
                <b>{c.name}</b>
                {c.source && (
                  <a href={c.source} target="_blank" rel="noreferrer">
                    공식 이미지
                  </a>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section
        className="board-overview"
        aria-labelledby="community-preview-title"
      >
        <div className="section board-overview-heading">
          <div>
            <small>COMMUNITY LOUNGE</small>
            <h2 id="community-preview-title">팬덤 소식 한눈에 보기</h2>
          </div>
          <a className="board-link-button" href="/boards#news">
            <Newspaper />
            커뮤니티 전체 보기
          </a>
        </div>
        <div className="board-overview-grid">
          <BoardSection
            id="news"
            tab="news"
            kicker="FANDOM NEWS"
            title="소식 게시판"
            icon={<Newspaper />}
            posts={news}
          />
          <BoardSection
            id="notices"
            tab="notices"
            kicker="NOTICE"
            title="공지 게시판"
            icon={<Megaphone />}
            posts={notices}
            dark
          />
        </div>
      </section>
      <ManualAdSlot ads={ads} slot="after-community" />
      <section id="events" className="section">
        <div className="section-head">
          <div>
            <small>EVENT & RESERVATION</small>
            <h2>행사 예약</h2>
          </div>
          <p>원하는 행사를 선택하고 관리자가 만든 신청폼을 작성하세요.</p>
        </div>
        <div className="event-grid">
          {openEvents.map((item, i) => (
            <article className="event-card" key={item.id}>
              <span>0{i + 1}</span>
              <p className="date">
                <CalendarDays />
                {new Date(item.date).toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </p>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <dl>
                <div>
                  <dt>장소</dt>
                  <dd>{item.place}</dd>
                </div>
                <div>
                  <dt>정원</dt>
                  <dd>{item.capacity}명</dd>
                </div>
              </dl>
              <Button
                 onClick={() =>
                   item.bookingType === "assigned_seat"
                     ? (window.location.href = "/events")
                     : user
                     ? setReserveEvent(item)
                    : (setAuthOpen(true),
                      setToast("예약하려면 로그인해 주세요."))
                }
              >
                예약하기
              </Button>
            </article>
          ))}
        </div>
        {user && (
          <div className="my-board">
            <h3>내 예약</h3>
            <DataTable
              headers={["행사", "신청일", "상태"]}
              rows={reservations
                .filter((r) => r.userId === user.uid)
                .map((r) => [
                  r.eventTitle,
                  new Date(r.createdAt).toLocaleDateString("ko-KR"),
                  statusLabel[r.status],
                ])}
            />
          </div>
        )}
      </section>
      <section id="inquiries" className="board-section inquiry-section">
        <div className="section">
          <div className="section-head">
            <div>
              <small>SUPPORT</small>
              <h2>문의 게시판</h2>
            </div>
            <a className="board-link-button" href="/boards#inquiries">
              <MessageSquareText />
              문의 게시판으로 이동
            </a>
          </div>
          {user ? (
            <DataTable
              headers={["분류", "제목", "작성일", "상태"]}
              rows={inquiries
                .filter((x) => isAdmin || x.userId === user.uid)
                .slice(0, 5)
                .map((x) => [
                  x.category,
                  <a
                    className="title-button"
                    key={x.id}
                    href={`/boards#inquiries/${x.id}`}
                  >
                    {x.title}
                  </a>,
                  new Date(x.createdAt).toLocaleDateString("ko-KR"),
                  statusLabel[x.status],
                ])}
            />
          ) : (
            <div className="login-gate">
              <MessageSquareText />
              <h3>회원 전용 문의 게시판입니다</h3>
              <p>
                로그인 후 전용 게시판 페이지에서 문의를 작성하고 답변 상태를
                확인할 수 있습니다.
              </p>
              <a className="board-link-button" href="/boards#inquiries">
                게시판 열기
              </a>
            </div>
          )}
        </div>
      </section>
      <section className="community">
        <Music2 />
        <small>OUR COMMUNITY</small>
        <h2>{site.communityMessage}</h2>
        <p>공식 작품과 권리자를 존중하는 비영리 팬 커뮤니티입니다.</p>
      </section>
      <footer className="site-footer">
        <div className="brand">
          <Image
            src={site.logoUrl}
            alt=""
            width={124}
            height={44}
            unoptimized
          />
          <span>{site.siteName}</span>
        </div>
        <p>
          팬덤 작성 콘텐츠는 각 작성자에게 권리가 있으며, K-ON!
          원작·상표·캐릭터의 권리는 각 권리자에게 있습니다. 비영리 비공식 팬
          커뮤니티입니다.
        </p>
      </footer>

      <Dialog
        open={authOpen}
        onOpenChange={(v) => {
          setAuthOpen(v);
          if (v) setAuthNotice("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {authMode === "login" ? "로그인" : "회원가입"}
            </DialogTitle>
            <DialogDescription>
              예약, 문의, 알림 기능을 이용할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <form className="form" onSubmit={memberAuth}>
            <Input name="email" type="email" placeholder="이메일" required />
            <Input
              name="password"
              type="password"
              minLength={6}
              placeholder="비밀번호 (6자 이상)"
              required
            />
            {authMode === "register" && <>
              <Input name="nickname" minLength={2} maxLength={20} placeholder="닉네임 (2~20자)" required />
              <Input name="referralCode" placeholder="친구 추천 코드 (선택)" />
            </>}
            <div className="auth-consents">
              <label>
                <input
                  name="terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  required={authMode === "register"}
                />{" "}
                <a href="/terms" target="_blank" rel="noreferrer">
                  이용약관
                </a>
                에 동의합니다.
              </label>
              <label>
                <input
                  name="privacy"
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  required={authMode === "register"}
                />{" "}
                <a href="/privacy" target="_blank" rel="noreferrer">
                  개인정보 처리방침
                </a>
                에 동의합니다.
              </label>
            </div>
            {authNotice && <p className="auth-notice">{authNotice}</p>}
            <Button>
              {authMode === "login" ? "이메일로 로그인" : "이메일 회원가입"}
            </Button>
          </form>
          <div className="auth-divider">
            <span>또는</span>
          </div>
          <Button type="button" variant="outline" onClick={googleAuth}>
            Google 계정으로 계속하기
          </Button>
          <button
            className="text-link"
            onClick={() => {
              setAuthMode(authMode === "login" ? "register" : "login");
              setAuthNotice("");
            }}
          >
            {authMode === "login"
              ? "계정이 없나요? 회원가입"
              : "이미 계정이 있나요? 로그인"}
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>내 계정</DialogTitle>
            <DialogDescription>{user?.email}</DialogDescription>
          </DialogHeader>
          <form className="form" onSubmit={saveProfile}>
            <label>
              닉네임
              <Input
                name="nickname"
                defaultValue={nickname}
                minLength={2}
                maxLength={20}
                required
              />
              {!nickname && <Input name="referralCode" placeholder="친구 추천 코드 (선택)" />}
            </label>
            <Button>닉네임 저장</Button>
          </form>
          <div className="account-danger">
            <h3>회원 탈퇴</h3>
            <p>로그인 계정이 삭제되며 되돌릴 수 없습니다.</p>
            <Button type="button" variant="outline" onClick={withdrawAccount}>
              회원 탈퇴
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={inboxOpen} onOpenChange={setInboxOpen}>
        <DialogContent className="scroll-dialog">
          <DialogHeader>
            <DialogTitle>내 알림함</DialogTitle>
            <DialogDescription>
              예약 진행 상황과 관리자 쪽지를 확인합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="inbox-list">
            {messages.length ? (
              messages.map((message) => (
                <button
                  key={message.id}
                  className={
                    message.read ? "message-card" : "message-card unread"
                  }
                  onClick={() => openMessage(message)}
                >
                  <span className="message-icon">
                    <Mail />
                  </span>
                  <span>
                    <b>{message.title}</b>
                    <p>{message.body}</p>
                    <time>
                      {new Date(message.createdAt).toLocaleString("ko-KR")}
                    </time>
                  </span>
                </button>
              ))
            ) : (
              <div className="inbox-empty">
                <Bell />
                <p>도착한 알림이 없습니다.</p>
              </div>
            )}
          </div>
          <Button variant="outline" onClick={enableNotifications}>
            <Bell />
            브라우저 백그라운드 알림 켜기
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!reserveEvent}
        onOpenChange={(v) => !v && setReserveEvent(null)}
      >
        <DialogContent className="scroll-dialog">
          <DialogHeader>
            <DialogTitle>{reserveEvent?.title} 예약</DialogTitle>
            <DialogDescription>
              필수 질문에 답한 뒤 예약을 제출하세요.
            </DialogDescription>
          </DialogHeader>
          <form className="form" onSubmit={reserve}>
            {reserveEvent?.formSchema.map((q) => (
              <div className="question" key={q.id}>
                {q.type !== "checkbox" && (
                  <label>
                    {q.label}
                    {q.required && <b>*</b>}
                  </label>
                )}
                {field(q)}
              </div>
            ))}
            <Button>예약 제출</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!activeInquiry}
        onOpenChange={(v) => !v && setActiveInquiry(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeInquiry?.title}</DialogTitle>
            <DialogDescription>
              {activeInquiry?.category} · {activeInquiry?.userEmail}
            </DialogDescription>
          </DialogHeader>
          <p className="post-body">{activeInquiry?.body}</p>
          {activeInquiry?.answer && (
            <div className="answer-box">
              <b>관리자 답변</b>
              <p>{activeInquiry.answer}</p>
            </div>
          )}
          {can("applications") && !activeInquiry?.answer && (
            <form className="form" onSubmit={answerInquiry}>
              <Textarea name="answer" placeholder="답변 내용" required />
              <Button>답변 등록</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AdminDialog
        open={adminOpen}
        setOpen={setAdminOpen}
        can={can}
        user={user}
        role={role}
        site={site}
        events={events}
        notices={notices}
        news={news}
        inquiries={inquiries}
        reservations={reservations}
        adminNotices={adminNotices}
        saveSite={saveSite}
        createEvent={createEvent}
        createPost={createPost}
        createAdminNotice={createAdminNotice}
        setActiveInquiry={setActiveInquiry}
        advanceReservation={advanceReservation}
        sendAccountMessage={sendAccountMessage}
        manageAdmin={manageAdmin}
      />
    </main>
  );
}

function ManualAdSlot({
  ads,
  slot,
}: {
  ads: ManualAd[];
  slot: ManualAd["slot"];
}) {
  const ad = ads.find((item) => item.slot === slot && item.active);
  if (!ad) return null;
  const content = (
    <>
      <div className="manual-ad-copy">
        <small>{ad.label || "PARTNER"}</small>
        <h3>{ad.title}</h3>
        <p>{ad.body}</p>
        {ad.href && (
          <span>
            자세히 보기 <span aria-hidden="true">↗</span>
          </span>
        )}
      </div>
      {ad.imageUrl && (
        <Image src={ad.imageUrl} alt="" width={220} height={104} unoptimized />
      )}
    </>
  );
  return ad.href ? (
    <a
      className="manual-ad"
      href={ad.href}
      target={ad.href.startsWith("http") ? "_blank" : undefined}
      rel={ad.href.startsWith("http") ? "noreferrer" : undefined}
    >
      {content}
    </a>
  ) : (
    <div className="manual-ad">{content}</div>
  );
}
function BoardSection({
  id,
  tab,
  kicker,
  title,
  icon,
  posts,
  dark = false,
}: {
  id: string;
  tab: "news" | "notices";
  kicker: string;
  title: string;
  icon: React.ReactNode;
  posts: Post[];
  dark?: boolean;
}) {
  return (
    <section id={id} className={`board-section ${dark ? "dark" : ""}`}>
      <div className="section">
        <div className="section-head">
          <div>
            <small>{kicker}</small>
            <h2>{title}</h2>
          </div>
          <a className="board-link-button" href={`/boards#${tab}`}>
            {icon}전체 보기
          </a>
        </div>
        <DataTable
          headers={["번호", "분류", "제목", "작성일"]}
          rows={posts.slice(0, 5).map((p, i) => [
            p.pinned ? "필독" : String(posts.length - i).padStart(2, "0"),
            p.category,
            <a
              className="title-button"
              key={p.id}
              href={`/boards#${tab}/${p.id}`}
            >
              {p.title}
            </a>,
            new Date(p.createdAt).toLocaleDateString("ko-KR"),
          ])}
        />
      </div>
    </section>
  );
}
function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="empty-row">
                등록된 글이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

type AdminProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  can: (p: Permission) => boolean;
  user: User | null;
  role: string;
  site: SiteSettings;
  events: EventItem[];
  notices: Post[];
  news: Post[];
  inquiries: Inquiry[];
  reservations: Reservation[];
  adminNotices: AdminNotice[];
  saveSite: (e: FormEvent<HTMLFormElement>) => void;
  createEvent: (e: FormEvent<HTMLFormElement>) => void;
  createPost: (e: FormEvent<HTMLFormElement>, k: "notices" | "news") => void;
  createAdminNotice: (e: FormEvent<HTMLFormElement>) => void;
  setActiveInquiry: (v: Inquiry) => void;
  advanceReservation: (v: Reservation) => void;
  sendAccountMessage: (e: FormEvent<HTMLFormElement>) => void;
  manageAdmin: (e: FormEvent<HTMLFormElement>) => void;
};
function AdminDialog(p: AdminProps) {
  return (
    <Dialog open={p.open} onOpenChange={p.setOpen}>
      <DialogContent className="admin-dialog">
        <DialogHeader>
          <DialogTitle>관리자 스튜디오</DialogTitle>
          <DialogDescription>
            {p.role === "owner" ? "총관리자" : p.user?.email} 권한으로 접속
            중입니다.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="admin-notices">
          <TabsList className="admin-tabs">
            <TabsTrigger value="admin-notices">내 공지</TabsTrigger>
            {p.can("design") && (
              <TabsTrigger value="design">디자인</TabsTrigger>
            )}
            {p.can("events") && (
              <TabsTrigger value="events">행사·폼</TabsTrigger>
            )}
            {p.can("notices") && (
              <TabsTrigger value="boards">게시판</TabsTrigger>
            )}
            {p.can("applications") && (
              <TabsTrigger value="support">문의·예약</TabsTrigger>
            )}
            {p.role === "owner" && (
              <TabsTrigger value="permissions">권한 관리</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="admin-notices">
            <DataTable
              headers={["대상", "제목", "작성일"]}
              rows={p.adminNotices.map((n) => [
                n.audiences.join(","),
                n.title,
                new Date(n.createdAt).toLocaleDateString("ko-KR"),
              ])}
            />
            {p.can("users") && (
              <form className="admin-form" onSubmit={p.createAdminNotice}>
                <h3>관리자 공지 작성</h3>
                <label>
                  대상
                  <select name="audience">
                    <option value="all">전체</option>
                    <option value="design">디자인</option>
                    <option value="events">행사</option>
                    <option value="notices">게시판</option>
                    <option value="applications">문의·예약</option>
                    <option value="users">권한관리</option>
                  </select>
                </label>
                <label>
                  제목
                  <Input name="title" required />
                </label>
                <label>
                  내용
                  <FormRichTextEditor label="내용" />
                </label>
                <Button>등록</Button>
              </form>
            )}
          </TabsContent>
          <TabsContent value="design">
            <form className="admin-form two" onSubmit={p.saveSite}>
              <label>
                사이트 이름
                <Input name="siteName" defaultValue={p.site.siteName} />
              </label>
              <label>
                강조 색상
                <Input
                  name="accentColor"
                  type="color"
                  defaultValue={p.site.accentColor}
                />
              </label>
              <label>
                로고 URL
                <Input name="logoUrl" type="url" defaultValue={p.site.logoUrl} placeholder="https://..." />
                <small>외부에 올린 이미지의 직접 링크를 입력하세요.</small>
              </label>
              <label>
                히어로 작은 문구
                <Input name="heroEyebrow" defaultValue={p.site.heroEyebrow} />
              </label>
              <label>
                히어로 제목
                <Textarea name="heroTitle" defaultValue={p.site.heroTitle} />
              </label>
              <label>
                히어로 설명
                <Textarea
                  name="heroDescription"
                  defaultValue={p.site.heroDescription}
                />
              </label>
              <label>
                커뮤니티 문구
                <Input
                  name="communityMessage"
                  defaultValue={p.site.communityMessage}
                />
              </label>
              <label>
                히어로 이미지 URL 목록
                <Textarea
                  name="heroImages"
                  defaultValue={p.site.heroImages.join("\n")}
                />
                <small>
                  외부 이미지의 직접 URL을 한 줄에 하나씩 입력하세요.
                  최소 1장, 2장부터 자동 슬라이드됩니다.
                </small>
              </label>
              <label className="full">
                캐릭터 이미지 목록
                <Textarea
                  name="characterImages"
                  rows={7}
                  defaultValue={p.site.characterImages
                    .map((c) =>
                      [c.name, c.url, c.source].filter(Boolean).join("|"),
                    )
                    .join("\n")}
                />
                <small>
                  이름 | 이미지 URL | 출처 URL 형식, 한 줄에 한 명. 외부 URL
                  을 입력하세요.
                </small>
              </label>
              <Button className="full">
                <Upload />
                디자인 저장
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="events">
            <form className="admin-form two" onSubmit={p.createEvent}>
              <label>
                행사명
                <Input name="title" required />
              </label>
              <label>
                일시
                <Input name="date" type="datetime-local" required />
              </label>
              <label>
                장소
                <Input name="place" required />
              </label>
              <label>
                정원
                <Input name="capacity" type="number" min="1" required />
              </label>
              <label className="full">
                소개
                <Textarea name="summary" required />
              </label>
              <label className="full">
                질문 목록
                <Textarea
                  name="schema"
                  rows={7}
                  defaultValue={
                    "닉네임|text|required\n이메일|email|required\n참여 방식|select|required|오프라인,온라인\n요청사항|textarea|optional\n안내 확인|checkbox|required"
                  }
                />
                <small>
                  질문 | 형태 | required/optional | 선택지. 형태: text, email,
                  tel, textarea, select, radio, checkbox
                </small>
              </label>
              <label className="full">
                또는 질문 JSON 업로드
                <Input
                  name="schemaFile"
                  type="file"
                  accept=".json,application/json"
                />
              </label>
              <Button className="full">행사·신청폼 등록</Button>
            </form>
          </TabsContent>
          <TabsContent value="boards">
            <div className="split-admin">
              <form
                className="admin-form"
                onSubmit={(e) => p.createPost(e, "notices")}
              >
                <h3>공지 작성</h3>
                <Input name="category" placeholder="분류" required />
                <Input name="title" placeholder="제목" required />
                <FormRichTextEditor label="본문" />
                <Input name="attachmentName" placeholder="첨부 이름" />
                <Input name="attachmentUrl" type="url" placeholder="첨부 공유 링크" />
                <label className="check-line">
                  <input name="pinned" type="checkbox" />
                  필독
                </label>
                <Button>공지 등록</Button>
              </form>
              <form
                className="admin-form"
                onSubmit={(e) => p.createPost(e, "news")}
              >
                <h3>소식 작성</h3>
                <Input name="category" placeholder="분류" required />
                <Input name="title" placeholder="제목" required />
                <FormRichTextEditor label="본문" />
                <Input name="attachmentName" placeholder="첨부 이름" />
                <Input name="attachmentUrl" type="url" placeholder="첨부 공유 링크" />
                <Button>소식 등록</Button>
              </form>
            </div>
          </TabsContent>
          <TabsContent value="support">
            <h3>문의</h3>
            <DataTable
              headers={["회원", "제목", "상태"]}
              rows={p.inquiries.map((i) => [
                i.userEmail,
                <button
                  className="title-button"
                  key={i.id}
                  onClick={() => p.setActiveInquiry(i)}
                >
                  {i.title}
                </button>,
                statusLabel[i.status],
              ])}
            />
            <h3 className="admin-subtitle">예약</h3>
            <DataTable
              headers={["회원", "행사", "상태", "처리"]}
              rows={p.reservations.map((r) => [
                r.userEmail,
                r.eventTitle,
                statusLabel[r.status],
                <Button
                  key={r.id}
                  size="sm"
                  disabled={r.status === "completed"}
                  onClick={() => p.advanceReservation(r)}
                >
                  다음
                </Button>,
              ])}
            />
            <form className="admin-form" onSubmit={p.sendAccountMessage}>
              <h3>신청자에게 쪽지 보내기</h3>
              <label>
                받는 사람
                <select name="userId" required>
                  <option value="">예약자를 선택하세요</option>
                  {Array.from(
                    new Map(p.reservations.map((r) => [r.userId, r])).values(),
                  ).map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.userEmail}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                제목
                <Input name="title" required />
              </label>
              <label>
                내용
                <Textarea name="body" required />
              </label>
              <Button>
                <Mail />
                계정 쪽지 보내기
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="permissions">
            <div className="permission-panel">
              <div>
                <small>OWNER ONLY</small>
                <h3>관리자 권한 추가·변경</h3>
                <p>
                  대상 계정은 먼저 홈페이지에서 회원가입해야 합니다. 이메일과
                  담당 업무만 선택하면 서버에서 안전하게 권한을 적용합니다.
                </p>
              </div>
              <form className="admin-form" onSubmit={p.manageAdmin}>
                <label>
                  회원 이메일
                  <Input
                    name="email"
                    type="email"
                    placeholder="manager@example.com"
                    required
                  />
                </label>
                <fieldset>
                  <legend>담당 권한</legend>
                  <label className="permission-card featured">
                    <input
                      name="permissions"
                      type="checkbox"
                      value="notices"
                      defaultChecked
                    />
                    <span>
                      <b>게시판 관리</b>
                      <small>공지와 소식을 작성·수정·삭제</small>
                    </span>
                  </label>
                  <label className="permission-card">
                    <input name="permissions" type="checkbox" value="design" />
                    <span>
                      <b>디자인 관리</b>
                      <small>로고, 히어로와 캐릭터 이미지 설정</small>
                    </span>
                  </label>
                  <label className="permission-card">
                    <input name="permissions" type="checkbox" value="events" />
                    <span>
                      <b>행사 관리</b>
                      <small>행사와 신청폼 제작 및 예약 처리</small>
                    </span>
                  </label>
                  <label className="permission-card">
                    <input
                      name="permissions"
                      type="checkbox"
                      value="applications"
                    />
                    <span>
                      <b>문의·신청 관리</b>
                      <small>문의 답변, 신청 상태와 회원 쪽지 관리</small>
                    </span>
                  </label>
                  <label className="permission-card">
                    <input name="permissions" type="checkbox" value="users" />
                    <span>
                      <b>관리자 공지</b>
                      <small>권한별 내부 공지 작성</small>
                    </span>
                  </label>
                </fieldset>
                <p className="permission-hint">
                  기존 관리자의 권한을 바꾸려면 같은 이메일로 다시 저장하세요.
                  모든 항목을 해제하고 저장하면 일반 회원으로 변경됩니다.
                </p>
                <Button>
                  <Users />
                  관리자 권한 저장
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
        <div className="admin-footer">
          <span>
            <Users />
            {p.user?.email}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => auth && signOut(auth)}
          >
            <LogOut />
            로그아웃
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
