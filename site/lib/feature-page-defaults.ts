export type BuiltInScheduleItem = {
  startAt: string;
  endAt?: string;
  title: string;
  description?: string;
  place?: string;
};

export type BuiltInActionButton = {
  label: string;
  url: string;
  kind?: "recruit" | "survey" | "apply" | "link";
  placement?: "hero" | "content";
  style?: "primary" | "outline";
};

export type BuiltInEventPageBlock = {
  id: string;
  type: "heading" | "text" | "card" | "image" | "video" | "button" | "countdown" | "schedule" | "divider" | "spacer";
  title?: string;
  body?: string;
  imageUrl?: string;
  alt?: string;
  videoUrl?: string;
  label?: string;
  url?: string;
  buttonStyle?: "primary" | "outline";
  targetAt?: string;
  alignment?: "left" | "center" | "right";
  width?: "full" | "half" | "third";
  backgroundColor?: string;
  textColor?: string;
  padding?: "compact" | "normal" | "roomy";
};

export type BuiltInFeaturePage = {
  id: string;
  slug: string;
  title: string;
  menuLabel: string;
  summary: string;
  body?: string;
  coverImageUrl?: string;
  videoUrl?: string;
  eventId?: string;
  eventStartAt?: string;
  publishAt?: string;
  hideAt?: string;
  active: boolean;
  showInMenu?: boolean;
  showOnHome?: boolean;
  themeColor?: string;
  buttonAlignment?: "left" | "center" | "right";
  order?: number;
  scheduleItems?: BuiltInScheduleItem[];
  actionButtons?: BuiltInActionButton[];
  contentBlocks?: BuiltInEventPageBlock[];
};

export const MOVIE_FEATURE_SLUG = "k-on-movie-2026";
export const YUI_BIRTHDAY_FEATURE_SLUG = "yui-birthday-cafe-busan-2026";
export const AZUSA_BIRTHDAY_FEATURE_SLUG = "azusa-birthday-cafe-2026";

const YUI_ASSET_ROOT = "/events/yui-birthday-2026";

export const MOVIE_FEATURE_PAGE: BuiltInFeaturePage = {
  id: MOVIE_FEATURE_SLUG,
  slug: MOVIE_FEATURE_SLUG,
  title: "다시 극장에서 만나는 케이온",
  menuLabel: "케이온 영화",
  summary: "2026년 10월 14일 롯데시네마 단독 재재재개봉. 예매 회차와 특전 소식을 한곳에서 확인하고 알림을 받아보세요.",
  body: "롯데시네마 상영시간표를 주기적으로 확인해 새 회차가 열리면 알려드립니다. 현재 상영관과 남은 좌석은 아래 실시간 감지 영역에서 확인하세요.",
  coverImageUrl: "https://cf.lottecinema.co.kr//Media/MovieFile/MovieImg/202503/22284_503_1.jpg",
  active: true,
  showInMenu: true,
  showOnHome: false,
  order: 20,
};

export const YUI_BIRTHDAY_FEATURE_PAGE: BuiltInFeaturePage = {
  id: YUI_BIRTHDAY_FEATURE_SLUG,
  slug: YUI_BIRTHDAY_FEATURE_SLUG,
  title: "딸기가 좋은 유이의 우당탕탕 생일 파티",
  menuLabel: "유이 생일 카페",
  summary: "2026년 11월, 부산에서 유이의 생일을 함께 축하해요. 방문 특전부터 공연과 전시 모집까지 한 페이지에서 확인할 수 있습니다.",
  coverImageUrl: `${YUI_ASSET_ROOT}/hero.png`,
  eventStartAt: "2026-11-28T11:30:00+09:00",
  active: true,
  showInMenu: true,
  showOnHome: true,
  themeColor: "#e84670",
  buttonAlignment: "left",
  order: 10,
  scheduleItems: [
    {
      startAt: "2026-11-28T11:30:00+09:00",
      endAt: "2026-11-28T19:30:00+09:00",
      title: "유이 생일 카페 · 첫째 날",
      description: "방문 특전 배부와 전시, 현장 프로그램이 진행됩니다. 운영 시간은 현장 사정에 따라 조금 달라질 수 있습니다.",
      place: "부산대 숏버스 스테이션",
    },
    {
      startAt: "2026-11-29T11:30:00+09:00",
      endAt: "2026-11-29T19:30:00+09:00",
      title: "유이 생일 카페 · 둘째 날",
      description: "오후 공연을 포함한 세부 일정은 확정되는 대로 페이지에서 안내합니다.",
      place: "부산대 숏버스 스테이션",
    },
  ],
  actionButtons: [
    {
      label: "방문 수요조사 참여 (11/27 제외)",
      url: "https://forms.gle/nmx88GbJpNbuqfaf6",
      kind: "survey",
      placement: "hero",
      style: "primary",
    },
    {
      label: "공연 참가 지원",
      url: "https://forms.gle/6JbaDDdGJ1ZSZKXv9",
      kind: "recruit",
      placement: "hero",
      style: "outline",
    },
  ],
  contentBlocks: [
    { id: "yui-logo", type: "image", imageUrl: `${YUI_ASSET_ROOT}/event-logo-current.png`, alt: "딸기가 좋은 유이의 우당탕탕 생일 파티 로고", width: "full" },
    { id: "when-heading", type: "heading", title: "언제, 어디서 만날까요?", width: "full", padding: "roomy", alignment: "center" },
    { id: "date-card", type: "card", title: "2026. 11. 28 — 29", body: "토요일부터 일요일까지\n운영 시간 11:30—19:30 예정", width: "half", backgroundColor: "#fff4f4", padding: "roomy", alignment: "center" },
    { id: "place-card", type: "card", title: "부산대 숏버스 스테이션", body: "부산광역시 금정구 금정로60번길 24, 3층\n부산대역 인근", width: "half", backgroundColor: "#fffaf5", padding: "roomy", alignment: "center" },
    { id: "countdown", type: "countdown", targetAt: "2026-11-28T11:30:00+09:00", width: "full", backgroundColor: "#5b1734", padding: "normal", alignment: "center" },
    { id: "schedule", type: "schedule", width: "full", padding: "normal" },
    { id: "divider-1", type: "divider", width: "full" },
    { id: "gift-heading", type: "heading", title: "유이와 함께할 추억을 간직해요", width: "full", padding: "roomy", alignment: "center" },
    { id: "gift-photo", type: "image", imageUrl: `${YUI_ASSET_ROOT}/03-benefit-photocards.png`, alt: "방문 특전 포토카드 3종", width: "half" },
    { id: "gift-postcard", type: "image", imageUrl: `${YUI_ASSET_ROOT}/04-benefit-postcard.png`, alt: "유이 생일 파티 초대장 엽서", width: "half" },
    { id: "gift-note", type: "card", title: "방문 특전", body: "포토카드 3종과 엽서 1종을 준비했어요.\n엽서는 음료 구매 없이도 퀴즈 등 현장 이벤트 참여 후 받을 수 있습니다.\n\n※ 공개 이미지는 특전 예시이며 실제 인쇄물은 일부 달라질 수 있습니다.", width: "full", backgroundColor: "#fff1f4", padding: "roomy", alignment: "center" },
    { id: "divider-2", type: "divider", width: "full" },
    { id: "together-heading", type: "heading", title: "함께 만드는 생일 파티", width: "full", padding: "roomy", alignment: "center" },
    { id: "display-image", type: "image", imageUrl: `${YUI_ASSET_ROOT}/07-display-recruit.png`, alt: "전시 굿즈 모집 안내", width: "third" },
    { id: "performer-card", type: "card", title: "공연자 모집", body: "11월 28—29일 오후 공연\n히라사와 유이 주제 케이온 전체곡 가능\n밴드·악기 연주·노래 모두 환영해요.\n리허설 영상은 11월 25일까지 준비해 주세요.", width: "half", backgroundColor: "#5b1734", textColor: "#fff8f2", padding: "roomy" },
    { id: "display-card", type: "card", title: "전시 굿즈 모집", body: "피규어, 아크릴 스탠드, 포토카드, 액자, 포스터와 배너 등으로 공간을 함께 채워 주세요.\n반입은 11월 26—27일 권장, 현장 반입은 11월 28일 오전 11시까지입니다.", width: "half", backgroundColor: "#eff8f1", textColor: "#285840", padding: "roomy" },
    { id: "performer-button", type: "button", label: "공연 지원 폼 작성하기", url: "https://forms.gle/6JbaDDdGJ1ZSZKXv9", buttonStyle: "primary", width: "half", padding: "normal", alignment: "center" },
    { id: "display-contact-button", type: "button", label: "전시 굿즈 참여 문의", url: "mailto:bearman.entp@gmail.com?subject=2026%20부산%20유이%20생일카페%20전시%20굿즈%20참여%20문의", buttonStyle: "outline", width: "half", padding: "normal", alignment: "center" },
    { id: "survey-notice", type: "card", title: "방문 수요조사 투표 안내", body: "11월 27일은 정식 생일카페 운영일이 아닙니다. 진행하더라도 아주 소규모의 저녁 식사 모임 정도로만 열릴 수 있으니, 방문 수요조사 투표에서는 11월 27일을 제외해 주세요.", width: "full", backgroundColor: "#fff1f4", textColor: "#7a2942", padding: "normal", alignment: "center" },
    { id: "survey-button", type: "button", label: "방문 수요조사 참여하기 (11/27 제외)", url: "https://forms.gle/nmx88GbJpNbuqfaf6", buttonStyle: "primary", width: "full", padding: "normal", alignment: "center" },
    { id: "survey-image", type: "image", imageUrl: `${YUI_ASSET_ROOT}/08-visit-survey.png`, alt: "방문 수요조사 QR 코드", width: "full" },
    { id: "divider-3", type: "divider", width: "full" },
    { id: "support-heading", type: "heading", title: "생일 파티를 함께 준비해요", width: "full", padding: "roomy", alignment: "center" },
    { id: "support-a", type: "card", title: "방문 특전 지류 · 4,000원", body: "포토카드 3종 각 1장 + 엽서 1장\n현장 방문자는 같은 구성을 1세트 무료로 받을 수 있으며, 이 옵션은 방문이 어려운 분을 위한 택배 선택지입니다.", width: "third", backgroundColor: "#fff1f4", padding: "normal" },
    { id: "support-b", type: "card", title: "포스터 · 8,000원", body: "A3 포스터 1장\n각 후원 옵션은 독립 구성으로 운영됩니다.", width: "third", backgroundColor: "#fffaf5", padding: "normal" },
    { id: "support-c", type: "card", title: "아크릴 특전 · 각 30,000원", body: "아크릴 스탠드 1개 또는\n아크릴 키링 1개 + 단면 기타 피크 1개", width: "third", backgroundColor: "#eff8f1", padding: "normal" },
    { id: "support-note", type: "text", title: "후원 운영 안내", body: "후원 기간은 2026년 10월 17일 18:00부터 11월 8일 23:59까지입니다. 후원금의 수령·사용 내역은 개인정보를 제외하고 공개하며, 남은 후원금은 향후 케이온 팬덤 행사 지원에 사용합니다. 후원 링크와 배송비 등 세부 안내는 공식 공지를 확인해 주세요.", width: "full", backgroundColor: "#fff8f2", padding: "roomy", alignment: "center" },
  ],
};

export const AZUSA_BIRTHDAY_FEATURE_PAGE: BuiltInFeaturePage = {
  id: AZUSA_BIRTHDAY_FEATURE_SLUG,
  slug: AZUSA_BIRTHDAY_FEATURE_SLUG,
  title: "아즈사 생일카페 2026",
  menuLabel: "아즈사 생일카페",
  summary: "2026년 11월 7~8일, 홍대 스튜디오 앱트에서 열리는 아즈사 생일카페. 수요조사에 참여하고 예정 이벤트를 확인하세요.",
  coverImageUrl: "/events/azusa-birthday-2026/hero-v2.png",
  eventStartAt: "2026-11-07T00:00:00+09:00",
  publishAt: "2026-10-27T00:00:00+09:00",
  hideAt: "2026-11-09T00:00:00+09:00",
  active: true,
  showInMenu: true,
  showOnHome: true,
  themeColor: "#59b9ad",
  buttonAlignment: "center",
  order: 5,
  actionButtons: [{ label:"수요조사 참여", url:"https://docs.google.com/forms/d/e/1FAIpQLSfq2xw1mRIeIvKmGirTrzy6iWRRNPbwAesMIJkzC75iOi23iA/viewform?usp=publish-editor", kind:"survey", placement:"hero", style:"primary" }],
  contentBlocks: [
    { id:"azusa-heading", type:"heading", width:"full", alignment:"center", padding:"roomy", backgroundColor:"#fffaf5", textColor:"#3a2d32", title:"아즈사의 생일을 함께 축하해요" },
    { id:"azusa-intro", type:"text", width:"full", alignment:"center", padding:"normal", backgroundColor:"#e9f8f4", textColor:"#284a46", title:"AZUSA BIRTHDAY CAFE 2026", body:"11월 7일 토요일부터 8일 일요일까지, 홍대에서 아즈사의 생일을 함께 축하합니다. 방문 전 수요조사에 참여해 주세요!" },
    { id:"azusa-when", type:"card", width:"half", alignment:"center", padding:"roomy", backgroundColor:"#f6e5ea", textColor:"#4c3039", title:"WHEN", body:"2026. 11. 07 (토) – 11. 08 (일)\n일요일에는 케이크 커팅식이 예정되어 있습니다." },
    { id:"azusa-where", type:"card", width:"half", alignment:"center", padding:"roomy", backgroundColor:"#e6f3ef", textColor:"#29443f", title:"WHERE", body:"홍대 스튜디오 앱트 STUDIOAPT\n서울 마포구 동교로30길 19, 2층(2.5층)\n홍대입구역 3번 출구에서 도보 3분" },
    { id:"azusa-countdown", type:"countdown", width:"full", alignment:"center", padding:"normal", backgroundColor:"#3e3035", textColor:"#fffaf7", targetAt:"2026-11-07T00:00:00+09:00" },
    { id:"azusa-lucky-draw", type:"card", width:"third", alignment:"center", padding:"roomy", backgroundColor:"#fff1d6", textColor:"#4f3b22", title:"LUCKY DRAW", body:"아즈사 생일카페 럭키드로우가 예정되어 있습니다." },
    { id:"azusa-cake", type:"card", width:"third", alignment:"center", padding:"roomy", backgroundColor:"#f7dfe8", textColor:"#573440", title:"CAKE CUTTING", body:"11월 8일 일요일, 케이크 커팅식을 진행할 예정입니다." },
    { id:"azusa-display", type:"card", width:"third", alignment:"center", padding:"roomy", backgroundColor:"#dff2ee", textColor:"#294b46", title:"AZUSA DISPLAY", body:"다양한 아즈사 굿즈와 3 뭇땅(앰프) 등으로 공간을 풍성하게 꾸밀 예정입니다." },
    { id:"azusa-survey-copy", type:"text", width:"full", alignment:"center", padding:"roomy", backgroundColor:"#fffaf5", textColor:"#3e2824", title:"방문 의사를 알려주세요", body:"방문 여부와 가능한 날짜를 알려주시면 생일카페 준비에 큰 도움이 됩니다. 포스터·메뉴·특전은 추후 공개될 예정입니다." },
    { id:"azusa-survey-button", type:"button", width:"half", alignment:"center", padding:"normal", label:"생일카페 수요조사 참여", url:"https://docs.google.com/forms/d/e/1FAIpQLSfq2xw1mRIeIvKmGirTrzy6iWRRNPbwAesMIJkzC75iOi23iA/viewform?usp=publish-editor", buttonStyle:"primary" },
    { id:"azusa-instagram-button", type:"button", width:"half", alignment:"center", padding:"normal", label:"문의 · @k_on_guitar", url:"https://www.instagram.com/k_on_guitar/", buttonStyle:"outline" },
    { id:"azusa-notice", type:"text", width:"full", alignment:"center", padding:"compact", backgroundColor:"#4b373d", textColor:"#fff7f3", title:"NOTICE", body:"모든 문의는 카페 계정이 아닌 인스타그램 @k_on_guitar 로 연락해 주세요. 요청 시 주최자의 기타 연주가 있을지도…?" },
  ],
};

export const BUILT_IN_FEATURE_PAGES = [AZUSA_BIRTHDAY_FEATURE_PAGE, YUI_BIRTHDAY_FEATURE_PAGE, MOVIE_FEATURE_PAGE];

export function mergeBuiltInFeaturePages<T extends { slug: string }>(remote: T[]): Array<T | BuiltInFeaturePage> {
  const remoteSlugs = new Set(remote.map((page) => page.slug));
  return [...remote, ...BUILT_IN_FEATURE_PAGES.filter((page) => !remoteSlugs.has(page.slug))]
    .sort((a, b) => Number((a as { order?: number }).order || 0) - Number((b as { order?: number }).order || 0));
}

export function getBuiltInFeaturePage(slug: string) {
  return BUILT_IN_FEATURE_PAGES.find((page) => page.slug === slug) || null;
}
