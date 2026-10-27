import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = "k-on-web";
const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfq2xw1mRIeIvKmGirTrzy6iWRRNPbwAesMIJkzC75iOi23iA/viewform?usp=publish-editor";
const instagramUrl = "https://www.instagram.com/k_on_guitar/";
const coverImageUrl = "/events/azusa-birthday-2026/hero-v2.png";

const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
const firestore = getFirestore(app);
const id = "azusa-birthday-cafe-2026";
const contentBlocks = [
  { id:"azusa-heading", type:"heading", width:"full", alignment:"center", padding:"roomy", backgroundColor:"#fffaf5", textColor:"#3a2d32", title:"아즈사의 생일을 함께 축하해요" },
  { id:"azusa-intro", type:"text", width:"full", alignment:"center", padding:"normal", backgroundColor:"#e9f8f4", textColor:"#284a46", title:"AZUSA BIRTHDAY CAFE 2026", body:"11월 7일 토요일부터 8일 일요일까지, 홍대에서 아즈사의 생일을 함께 축하합니다. 방문 전 수요조사에 참여해 주세요!" },
  { id:"azusa-when", type:"card", width:"half", alignment:"center", padding:"roomy", backgroundColor:"#f6e5ea", textColor:"#4c3039", title:"WHEN", body:"2026. 11. 07 (토) – 11. 08 (일)\n일요일에는 케이크 커팅식이 예정되어 있습니다." },
  { id:"azusa-where", type:"card", width:"half", alignment:"center", padding:"roomy", backgroundColor:"#e6f3ef", textColor:"#29443f", title:"WHERE", body:"홍대 스튜디오 앱트 STUDIOAPT\n서울 마포구 동교로30길 19, 2층(2.5층)\n홍대입구역 3번 출구에서 도보 3분" },
  { id:"azusa-countdown", type:"countdown", width:"full", alignment:"center", padding:"normal", backgroundColor:"#3e3035", textColor:"#fffaf7", targetAt:"2026-11-07T00:00" },
  { id:"azusa-lucky-draw", type:"card", width:"third", alignment:"center", padding:"roomy", backgroundColor:"#fff1d6", textColor:"#4f3b22", title:"LUCKY DRAW", body:"아즈사 생일카페 럭키드로우가 예정되어 있습니다." },
  { id:"azusa-cake", type:"card", width:"third", alignment:"center", padding:"roomy", backgroundColor:"#f7dfe8", textColor:"#573440", title:"CAKE CUTTING", body:"11월 8일 일요일, 케이크 커팅식을 진행할 예정입니다." },
  { id:"azusa-display", type:"card", width:"third", alignment:"center", padding:"roomy", backgroundColor:"#dff2ee", textColor:"#294b46", title:"AZUSA DISPLAY", body:"다양한 아즈사 굿즈와 3 뭇땅(앰프) 등으로 공간을 풍성하게 꾸밀 예정입니다." },
  { id:"azusa-survey-copy", type:"text", width:"full", alignment:"center", padding:"roomy", backgroundColor:"#fffaf5", textColor:"#3e2824", title:"방문 의사를 알려주세요", body:"방문 여부와 가능한 날짜를 알려주시면 생일카페 준비에 큰 도움이 됩니다. 포스터·메뉴·특전은 추후 공개될 예정입니다." },
  { id:"azusa-survey-button", type:"button", width:"half", alignment:"center", padding:"normal", backgroundColor:"#fffaf5", textColor:"#3e2824", label:"생일카페 수요조사 참여", url:formUrl, buttonStyle:"primary" },
  { id:"azusa-instagram-button", type:"button", width:"half", alignment:"center", padding:"normal", backgroundColor:"#fffaf5", textColor:"#3e2824", label:"문의 · @k_on_guitar", url:instagramUrl, buttonStyle:"outline" },
  { id:"azusa-notice", type:"text", width:"full", alignment:"center", padding:"compact", backgroundColor:"#4b373d", textColor:"#fff7f3", title:"NOTICE", body:"모든 문의는 카페 계정이 아닌 인스타그램 @k_on_guitar 로 연락해 주세요. 요청 시 주최자의 기타 연주가 있을지도…?" },
];

await firestore.collection("featurePages").doc(id).set({
  slug:id,
  title:"아즈사 생일카페 2026",
  menuLabel:"아즈사 생일카페",
  summary:"2026년 11월 7~8일, 홍대 스튜디오 앱트에서 열리는 아즈사 생일카페. 수요조사에 참여하고 예정 이벤트를 확인하세요.",
  coverImageUrl,
  themeColor:"#59b9ad",
  eventStartAt:"2026-11-07T00:00:00+09:00",
  publishAt:"2026-10-27T00:00:00+09:00",
  hideAt:"2026-11-09T00:00:00+09:00",
  active:true,
  showInMenu:true,
  showOnHome:true,
  order:5,
  buttonAlignment:"center",
  scheduleItems:[],
  actionButtons:[
    { label:"수요조사 참여", url:formUrl, kind:"survey", placement:"hero", style:"primary" },
  ],
  contentBlocks,
  sourceUrl:formUrl,
  updatedAt:new Date().toISOString(),
}, { merge:true });

console.log(`Seeded featurePages/${id}`);
