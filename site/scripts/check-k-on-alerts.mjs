import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { createHash } from "node:crypto";

const TOPIC_ID="k-on-movie-2026";
const ENDPOINT="https://www.lottecinema.co.kr/LCWS/Ticketing/TicketingData.aspx";
const BOOKING_URL="/special?slug=k-on-movie-2026";
const DEFAULT_CONFIG={active:true,topicId:TOPIC_ID,title:"케이온 재재재개봉",movieCode:"22284",searchKeywords:"케이온,K-On!",cinemaIds:"1004,1009,4008,5005,2004,3024,1007,1016,1005",monitorDays:8,benefitSourceUrls:"https://www.lottecinema.co.kr/NLCHS/Event/EventTemplateInfo?eventId=201010016926683",benefitSoldOutKeywords:"소진,매진,증정 종료",benefitWeeks:"week-1|1주차 특전"};

const rawCredential=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if(!rawCredential)throw new Error("GitHub secret FIREBASE_SERVICE_ACCOUNT_JSON이 필요합니다.");
const serviceAccount=JSON.parse(rawCredential);
if(typeof serviceAccount.private_key==="string")serviceAccount.private_key=serviceAccount.private_key.replace(/\\n/g,"\n");
initializeApp({credential:cert(serviceAccount)});
const firestore=getFirestore();

function split(value){return String(value||"").split(/[\n,]/).map(item=>item.trim()).filter(Boolean);}
function parseBenefitWeeks(value){return split(value).map((item,index)=>{const [key,...label]=item.split("|");return{key:(label.length?key:`week-${index+1}`).trim(),label:(label.length?label.join("|"):key).trim()};}).filter(item=>item.key&&item.label);}
function kstDate(offset=0){const base=new Date(Date.now()+offset*86400000);const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(base);const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${value.year}-${value.month}-${value.day}`;}
function screeningTime(date,time){const [year,month,day]=String(date).split("-").map(Number),[hour,minute]=String(time).split(":").map(Number);return Date.UTC(year,month-1,day,hour-9,minute||0);}
async function lotte(payload){const body=new FormData();body.append("paramList",JSON.stringify(payload));const response=await fetch(ENDPOINT,{method:"POST",headers:{"User-Agent":"Mozilla/5.0 K-ON-Fandom-Monitor/1.0","Referer":"https://www.lottecinema.co.kr/NLCHS/Ticketing","Accept":"application/json"},body,signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`롯데시네마 응답 오류 ${response.status}`);const result=await response.json();if(String(result.IsOK)!=="true")throw new Error(result.ResultMessage||"롯데시네마 조회 실패");return result;}
async function lotteEvent(eventId){const body=new FormData();body.append("paramList",JSON.stringify({MethodName:"GetInfomationDeliveryEventDetail",channelType:"HO",osType:"Chrome",osVersion:"GitHub Actions",EventID:eventId}));const response=await fetch("https://www.lottecinema.co.kr/LCWS/Event/EventData.aspx",{method:"POST",headers:{"User-Agent":"Mozilla/5.0 K-ON-Fandom-Monitor/1.0","Referer":`https://www.lottecinema.co.kr/NLCHS/Event/EventTemplateInfo?eventId=${eventId}`,"Accept":"application/json"},body,signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`롯데 이벤트 응답 오류 ${response.status}`);const result=await response.json();if(String(result.IsOK)!=="true")throw new Error(result.ResultMessage||"롯데 이벤트 조회 실패");return result?.InfomationDeliveryEventDetail?.[0]||null;}
async function imageFingerprint(url){if(!url)return"";const response=await fetch(String(url).replace(/^http:/,"https:"),{headers:{"User-Agent":"Mozilla/5.0 K-ON-Fandom-Monitor/1.0"},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`특전 이미지 응답 오류 ${response.status}`);return createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex");}
async function batches(items,size,handler){const results=[];for(let index=0;index<items.length;index+=size)results.push(...await Promise.all(items.slice(index,index+size).map(handler)));return results;}
async function readConfig(){const snapshot=await firestore.collection("movieWatchTopics").where("topicId","==",TOPIC_ID).limit(1).get();const config=snapshot.empty?DEFAULT_CONFIG:{...DEFAULT_CONFIG,...snapshot.docs[0].data()};config.cinemaIds=DEFAULT_CONFIG.cinemaIds;return config;}
async function notifySubscribers(config,title,body,kind,affectedShowtimes=[]){
  const subscriptions=await firestore.collection("movieAlertSubscriptions").where("topicId","==",TOPIC_ID).get();
  const targets=new Set(affectedShowtimes.map(item=>String(item.cinemaId)));
  const active=subscriptions.docs.map(item=>item.data()).filter(item=>{
    if(item.active===false||(kind==="benefit"?item.notifyBenefits===false:item.notifyBooking===false))return false;
    if(kind!=="booking"||targets.size===0)return true;
    const selected=(item.theaterIds||[]).map(String);
    const candidateShowtimes=affectedShowtimes.filter(showtime=>selected.length===0||selected.includes(String(showtime.cinemaId)));
    const dates=(item.bookingDates||[]).map(String),weekdays=(item.weekdays||[]).map(Number);
    return candidateShowtimes.some(showtime=>{
      if(dates.length===0&&weekdays.length===0)return true;
      const weekday=new Date(`${showtime.date}T12:00:00+09:00`).getDay();
      return dates.includes(showtime.date)||weekdays.includes(weekday);
    });
  });
  const userIds=[...new Set(active.map(item=>item.userId).filter(Boolean))];
  const tokens=[];
  for(const group of Array.from({length:Math.ceil(userIds.length/30)},(_,index)=>userIds.slice(index*30,index*30+30))){if(!group.length)continue;const users=await Promise.all(group.map(uid=>firestore.doc(`users/${uid}`).get()));for(const user of users)tokens.push(...(Array.isArray(user.data()?.fcmTokens)?user.data().fcmTokens:[]));}
  const uniqueTokens=[...new Set(tokens.filter(Boolean))];
  for(let index=0;index<uniqueTokens.length;index+=500){await getMessaging().sendEachForMulticast({tokens:uniqueTokens.slice(index,index+500),notification:{title,body},data:{url:BOOKING_URL,kind,topicId:TOPIC_ID},webpush:{fcmOptions:{link:BOOKING_URL}}});}
  await Promise.all(active.map(item=>firestore.collection("accountMessages").add({userId:item.userId,userEmail:item.userEmail||"",title,body,kind:`movie_${kind}`,createdAt:new Date().toISOString(),read:false,url:BOOKING_URL,topicId:TOPIC_ID})));
  await firestore.collection("movieAlertEvents").add({topicId:TOPIC_ID,title,body,kind,createdAt:new Date().toISOString(),url:BOOKING_URL,source:"lottecinema"});
  console.log(`알림 ${kind}: 구독 ${active.length}명, 토큰 ${uniqueTokens.length}개`);
}

async function main(){
  const config=await readConfig();if(config.active===false){console.log("영화 알림 감시가 꺼져 있습니다.");return;}
  const now=new Date().toISOString(),stateRef=firestore.doc(`movieAlertStates/${TOPIC_ID}`),previous=(await stateRef.get()).data()||null;
  try{
    const landing=await lotte({MethodName:"GetTicketingPageTOBE",channelType:"HO",osType:"Chrome",osVersion:"GitHub Actions",memberOnNo:"0"});
    const movies=landing?.Movies?.Movies?.Items||[],keywords=split(config.searchKeywords).map(value=>value.toLowerCase());
    const movie=movies.find(item=>String(item.RepresentationMovieCode)===String(config.movieCode))||movies.find(item=>keywords.some(keyword=>`${item.MovieNameKR||""} ${item.MovieNameUS||""}`.toLowerCase().includes(keyword)));
    if(!movie)throw new Error("롯데시네마 영화 목록에서 케이온을 찾지 못했습니다.");
    const cinemaMap=new Map((landing?.Cinemas?.Cinemas?.Items||[]).map(item=>[String(item.CinemaID),item]));
    const subscriptions=await firestore.collection("movieAlertSubscriptions").where("topicId","==",TOPIC_ID).get();
    const requested=split(config.cinemaIds);for(const item of subscriptions.docs.map(doc=>doc.data()).filter(item=>item.active!==false))requested.push(...(item.theaterIds||[]).map(String));
    const cinemaIds=[...new Set(requested)].filter(id=>cinemaMap.has(id)).slice(0,24),days=Math.min(14,Math.max(1,Number(config.monitorDays||8))),jobs=[];
    for(let day=0;day<days;day++)for(const cinemaId of cinemaIds)jobs.push({date:kstDate(day),cinemaId});
    const responses=await batches(jobs,8,async job=>{const cinema=cinemaMap.get(job.cinemaId);try{const result=await lotte({MethodName:"GetPlaySequence",channelType:"HO",osType:"Chrome",osVersion:"GitHub Actions",playDate:job.date,cinemaID:`${cinema.DivisionCode}|${cinema.DetailDivisionCode}|${cinema.CinemaID}`,representationMovieCode:String(movie.RepresentationMovieCode)});return result?.PlaySeqs?.Items||[];}catch(error){console.warn(`${job.date} ${job.cinemaId}: ${error.message}`);return[];}});
    const elapsedHours=previous?.checkedAt?Math.max(1/12,(Date.now()-new Date(previous.checkedAt).getTime())/3600000):0,previousShowtimes=new Map((previous?.showtimes||[]).map(item=>[item.key,item]));
    const showtimes=responses.flat().map(item=>{const total=Number(item.TotalSeatCount||0),booked=Number(item.BookingSeatCount||0),available=String(item.IsBookingYN)==="Y"&&total-booked>0,key=`${item.PlayDt}_${item.CinemaID}_${item.ScreenID}_${item.PlaySequence}`,old=previousShowtimes.get(key),bookedDelta=old?booked-Number(old.bookedSeats||0):0;return{key,date:String(item.PlayDt||""),cinemaId:String(item.CinemaID||""),cinemaName:String(item.CinemaNameKR||cinemaMap.get(String(item.CinemaID))?.CinemaNameKR||"롯데시네마"),screenName:String(item.ScreenNameKR||"상영관"),screenType:String(item.ScreenDivisionNameKR||item.SoundTypeNameKR||item.FilmNameKR||"2D"),startTime:String(item.StartTime||""),endTime:String(item.EndTime||""),available,remainingSeats:Math.max(0,total-booked),totalSeats:total,bookedSeats:booked,bookedDelta,soldRate:total?Math.round(booked/total*1000)/10:0,salesPerHour:elapsedHours?Math.round(bookedDelta/elapsedHours*10)/10:0,bookingUrl:`https://www.lottecinema.co.kr/NLCHS/Ticketing?link_movieCd=${movie.RepresentationMovieCode}&link_cinemaCode=${item.CinemaID}&link_date=${item.PlayDt}&link_screenId=${item.ScreenID}&link_time=${encodeURIComponent(item.StartTime||"")}`};}).sort((a,b)=>`${a.date}${a.startTime}${a.cinemaName}`.localeCompare(`${b.date}${b.startTime}${b.cinemaName}`));
    const currentKeys=new Set(showtimes.map(item=>item.key)),recentCompleted=(previous?.showtimes||[]).filter(item=>!currentKeys.has(item.key)&&item.date&&item.endTime&&Date.now()>=screeningTime(item.date,item.endTime)&&Date.now()<=screeningTime(item.date,item.endTime)+24*60*60*1000).map(item=>({...item,available:false,remainingSeats:0})),displayShowtimes=[...recentCompleted,...showtimes].sort((a,b)=>`${a.date}${a.startTime}${a.cinemaName}`.localeCompare(`${b.date}${b.startTime}${b.cinemaName}`));
    const sourceUrls=split(config.benefitSourceUrls),soldOutWords=split(config.benefitSoldOutKeywords),benefitPages=[];
    for(const url of sourceUrls){try{const eventId=new URL(url).searchParams.get("eventId");if(eventId){const detail=await lotteEvent(eventId);if(!detail)throw new Error("이벤트 상세 정보가 없습니다.");const imageUrls=[detail.ImgUrl,detail.ImgUrl2,detail.ImgUrl3].filter(Boolean).map(value=>String(value).replace(/^http:/,"https:")),imageHashes=await Promise.all(imageUrls.map(imageFingerprint)),searchText=`${detail.EventName||""} ${detail.EventContents||""} ${detail.EventNotice||""}`,status=soldOutWords.some(word=>searchText.includes(word))?"sold_out":"announced";benefitPages.push({url,eventId,title:detail.EventName||"롯데시네마 특전 이벤트",startDate:detail.ProgressStartDate||"",endDate:detail.ProgressEndDate||"",imageUrls,status,fingerprint:createHash("sha256").update(JSON.stringify({detail,imageHashes})).digest("hex")});}else{const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 K-ON-Fandom-Monitor/1.0"},signal:AbortSignal.timeout(15000)}),text=await response.text();benefitPages.push({url,status:soldOutWords.some(word=>text.includes(word))?"sold_out":"announced",fingerprint:createHash("sha256").update(text).digest("hex")});}}catch(error){benefitPages.push({url,status:"error",fingerprint:"",error:error.message});}}
    const previousKeys=new Set((previous?.showtimes||[]).map(item=>item.key)),newAvailable=showtimes.filter(item=>item.available&&!previousKeys.has(item.key));
    const reportableShowtimeKeys=displayShowtimes.filter(item=>{if(!item.date||!item.endTime)return false;const endedAt=screeningTime(item.date,item.endTime);return Date.now()>=endedAt&&Date.now()<=endedAt+24*60*60*1000;}).map(item=>item.key);
    const reportSnapshot=await firestore.collection("benefitDepletionReports").where("topicId","==",TOPIC_ID).get(),validReports=reportSnapshot.docs.map(item=>item.data()).filter(item=>item.status!=="rejected"),communityReportCount=new Set(validReports.map(item=>item.userId)).size,communityVerifiedCount=new Set(validReports.filter(item=>item.status==="verified").map(item=>item.userId)).size;
    const availableCount=showtimes.filter(item=>item.available).length,soldOutCount=showtimes.length-availableCount,bookingOpen=availableCount>0,benefitStatus=benefitPages.some(item=>item.status==="sold_out")?"sold_out":benefitPages.length?"announced":"unconfigured",totalSeats=showtimes.reduce((sum,item)=>sum+item.totalSeats,0),bookedSeats=showtimes.reduce((sum,item)=>sum+item.bookedSeats,0),bookedDelta=showtimes.reduce((sum,item)=>sum+item.bookedDelta,0),soldRate=totalSeats?Math.round(bookedSeats/totalSeats*1000)/10:0,bookingVelocity=elapsedHours?Math.round(bookedDelta/elapsedHours*10)/10:0,metricsHistory=[...(previous?.metricsHistory||[]),{at:now,soldRate,bookedSeats,totalSeats,bookingVelocity}].slice(-144);
    let summary=previous?.lastChangeSummary||"변경 감시 중",changed=false;
    if(previous&&newAvailable.length){summary=`새 예매 가능 회차 ${newAvailable.length}개`;changed=true;await notifySubscribers(config,"🎸 케이온 예매 회차가 열렸어요",`${newAvailable[0].cinemaName} ${newAvailable[0].date} ${newAvailable[0].startTime}${newAvailable.length>1?` 외 ${newAvailable.length-1}회`:""}`,"booking",newAvailable);}
    else if(previous&&previous.bookingOpen===false&&bookingOpen){summary="예매가 열렸습니다";changed=true;const newlyOpen=showtimes.filter(item=>item.available);await notifySubscribers(config,"🎟️ 케이온 예매 오픈",`롯데시네마에서 예매 가능한 회차 ${availableCount}개를 확인했습니다.`,"booking",newlyOpen);}
    if(previous&&previous.benefitStatus!=="sold_out"&&benefitStatus==="sold_out"){summary="공식 특전 공지에서 소진 문구가 감지됐습니다";changed=true;await notifySubscribers(config,"케이온 특전 상태 변동",summary,"benefit");}
    else if(previous&&previous.benefitPages?.length&&benefitPages.some((item,index)=>item.status!=="error"&&item.fingerprint&&/^[a-f0-9]{64}$/.test(previous.benefitPages[index]?.fingerprint||"")&&item.fingerprint!==previous.benefitPages[index]?.fingerprint)){summary="롯데시네마 공식 특전 공지가 변경됐습니다";changed=true;await notifySubscribers(config,"🎁 케이온 특전 공지 변경",`${benefitPages.find(item=>item.title)?.title||"공식 특전 안내"} 내용이 바뀌었습니다. 최신 공지를 확인하세요.`,"benefit");}
    if(previous&&Number(previous.communityReportCount||0)<3&&communityReportCount>=3){summary=`특전 소진 제보가 ${communityReportCount}명 모였습니다`;changed=true;await notifySubscribers(config,"⚠️ 케이온 특전 소진 제보",`${communityReportCount}명이 특전 소진을 제보했습니다. 현장 수령 전 최신 상태를 확인하세요.`,"benefit");}
    await stateRef.set({topicId:TOPIC_ID,title:config.title,movieCode:String(movie.RepresentationMovieCode),movieName:movie.MovieNameKR||"케이온",posterUrl:String(movie.PosterURL||"").replace(/^http:/,"https:"),releaseDate:"2026-10-14",bookingOpen,showtimeCount:showtimes.length,availableCount,soldOutCount,totalSeats,bookedSeats,bookedDelta,soldRate,bookingVelocity,metricsHistory,showtimes:displayShowtimes.slice(0,160),reportableShowtimeKeys,communityReportCount,communityVerifiedCount,benefitWeeks:parseBenefitWeeks(config.benefitWeeks),benefitPages,benefitStatus,checkedAt:now,lastChangeAt:changed?now:previous?.lastChangeAt||null,lastChangeSummary:summary,sourceHealthy:true,sourceMessage:"롯데시네마 상영시간표 응답 정상"},{merge:true});
    console.log(`완료: ${showtimes.length}회, 예매 가능 ${availableCount}회, 감시 지점 ${cinemaIds.length}개`);
  }catch(error){await stateRef.set({topicId:TOPIC_ID,checkedAt:now,sourceHealthy:false,sourceMessage:String(error.message||error).slice(0,300)},{merge:true});throw error;}
}

await main();
