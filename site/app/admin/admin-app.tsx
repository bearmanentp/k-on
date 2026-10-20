"use client";

import { FormEvent, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import {
  Admin,
  ArrayInput,
  BooleanField,
  BooleanInput,
  Create,
  Datagrid,
  DateField,
  DateTimeInput,
  DeleteButton,
  Edit,
  EditButton,
  EmailField,
  FormDataConsumer,
  FunctionField,
  List,
  NumberField,
  NumberInput,
  Resource,
  SelectInput,
  SimpleForm,
  SimpleFormIterator,
  TextField,
  TextInput,
  required,
  useGetList,
  useNotify,
  usePermissions,
  useRefresh,
} from "react-admin";
import {
  Bell,
  Armchair,
  CalendarDays,
  CircleUserRound,
  ClipboardList,
  HelpCircle,
  ImagePlus,
  ListFilter,
  Mail,
  Megaphone,
  Newspaper,
  ShieldCheck,
  Store,
  Ticket,
  Film,
} from "lucide-react";
import { HashRouter, Link, useLocation } from "react-router-dom";
import { useFormContext } from "react-hook-form";
import {
  firebaseAuthProvider,
  firebaseDataProvider,
} from "./firebase-provider";
import { RichTextInput } from "./rich-text-input";
import { AdminDashboard } from "./dashboard";
import { SeatLayoutInput } from "./seat-layout-input";
import { db } from "@/lib/firebase";
import { DEFAULT_POINT_SETTINGS, type PointSettings } from "@/lib/points";
import { DEFAULT_CHARACTER_IMAGE_LINES, DEFAULT_CHARACTER_IMAGES, DEFAULT_K_ON_LOGO } from "@/lib/site-defaults";

const searchFilters = [<TextInput key="q" source="q" label="검색" alwaysOn />];

const adminTheme = {
  palette: {
    mode: "light" as const,
    primary: { main: "#a65d67", contrastText: "#fffaf7" },
    secondary: { main: "#d49a62", contrastText: "#3e2824" },
    background: { default: "#f7efe8", paper: "#fffdf9" },
    text: { primary: "#3e2824", secondary: "#806b66" },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: '"Pretendard", "Noto Sans KR", system-ui, sans-serif',
    h6: { fontWeight: 800 },
    button: { fontWeight: 800, textTransform: "none" as const },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: "#fffdf9",
          color: "#3e2824",
          boxShadow: "0 1px 0 #ead8cf",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { background: "#fff8f1", borderRight: "1px solid #ead8cf" },
      },
    },
    MuiButton: {
      styleOverrides: { root: { borderRadius: 12, boxShadow: "none" } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiTableCell: {
      styleOverrides: {
        head: { color: "#806b66", fontWeight: 800, background: "#fff5ed" },
        root: { borderColor: "#f0dfd5" },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined" as const, size: "small" as const },
    },
  },
};

function PostList() {
  return (
    <List filters={searchFilters} sort={{ field: "createdAt", order: "DESC" }}>
      <Datagrid rowClick="edit">
        <BooleanField source="pinned" label="필독" />
        <TextField source="category" label="분류" />
        <TextField source="title" label="제목" />
        <DateField source="createdAt" label="작성일" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}
function BoardDefinitionSelect() {
  const { data = [], isPending } = useGetList("boardDefinitions", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "order", order: "ASC" },
  });
  const choices = data
    .filter((board) => board.active !== false && !["news", "notices", "inquiries"].includes(String(board.key)))
    .map((board) => ({ id: String(board.key || board.id), name: String(board.label || board.key || board.id) }));
  return <SelectInput source="boardKey" label="게시판" choices={choices} validate={required()} isPending={isPending} fullWidth helperText="게시판 관리에서 만든 게시판을 선택하세요." />;
}

function PostForm({ withBoard = false }: { withBoard?: boolean }) {
  return (
    <SimpleForm>
      {withBoard && <BoardDefinitionSelect />}
      <TextInput
        source="prefix"
        label="말머리"
        helperText="예: [공지], [질문], [행사]"
      />
      <TextInput
        source="category"
        label="분류"
        validate={required()}
        fullWidth
      />
      <TextInput source="title" label="제목" validate={required()} fullWidth />
      <BooleanInput source="pinned" label="필독 고정" />
      <TextInput source="attachmentName" label="첨부 이름" />
      <TextInput
        source="attachmentUrl"
        label="첨부 링크"
        fullWidth
        helperText="Google Drive 공유 링크 또는 외부 파일 링크"
      />
      <TextInput source="pollQuestion" label="투표 질문" fullWidth />
      <TextInput
        source="pollOptions"
        label="투표 선택지"
        fullWidth
        helperText="선택지를 쉼표로 구분하세요. 예: 유이, 미오, 리츠"
      />
      <RichTextInput />
    </SimpleForm>
  );
}
function NoticeEdit() {
  return (
    <Edit>
      <PostForm />
    </Edit>
  );
}
function NoticeCreate() {
  return (
    <Create>
      <PostForm />
    </Create>
  );
}
function NewsEdit() {
  return (
    <Edit>
      <PostForm />
    </Edit>
  );
}
function NewsCreate() {
  return (
    <Create>
      <PostForm />
    </Create>
  );
}
function EventList() {
  return (
    <List sort={{ field: "date", order: "DESC" }}>
      <Datagrid rowClick="edit">
        <TextField source="title" label="행사명" />
        <DateField source="date" label="일시" showTime />
        <TextField source="place" label="장소" />
        <TextField source="bookingType" label="예매 방식" />
        <NumberField source="capacity" label="정원" />
        <FunctionField label="상태" render={(record:{status?:string})=>record.status==="open"?"접수 중":"마감"} />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}
function parseEventQuestions(value:string){
  return String(value||"").split("\n").map(line=>line.trim()).filter(Boolean).map((line,index)=>{const [label,type="text",requiredValue="optional",options=""]=line.split("|").map(part=>part.trim());return{id:`question-${index+1}`,label,type,required:requiredValue==="required",options:options.split(",").map(option=>option.trim()).filter(Boolean)};});
}
function formatEventQuestions(value:unknown){
  return Array.isArray(value)?value.map((field:{label?:string;type?:string;required?:boolean;options?:string[]})=>[field.label||"",field.type||"text",field.required?"required":"optional",Array.isArray(field.options)?field.options.join(","):""].join(" | ").replace(/ \| $/,"")).join("\n"):String(value||"");
}
function parseEventTimeSlots(value:string){
  return String(value||"").split("\n").map(line=>line.trim()).filter(Boolean).map((line,index)=>{const [idValue,label,startAt,endAt,capacityValue]=line.split("|").map(part=>part.trim());return{id:idValue||`slot-${index+1}`,label:label||idValue||`시간대 ${index+1}`,startAt:startAt||"",endAt:endAt||"",capacity:Math.max(1,Number(capacityValue||1))};});
}
function formatEventTimeSlots(value:unknown){
  return Array.isArray(value)?value.map((slot:{id?:string;label?:string;startAt?:string;endAt?:string;capacity?:number})=>[slot.id||"",slot.label||"",slot.startAt||"",slot.endAt||"",slot.capacity||""].join(" | ")).join("\n"):String(value||"");
}
const commaListFormat=(value:unknown)=>Array.isArray(value)?value.join(", "):String(value||"");
const commaListParse=(value:string)=>value.split(",").map(item=>item.trim()).filter(Boolean);
function EventForm() {
  return (
      <SimpleForm defaultValues={{status:"open",bookingType:"general",capacity:20,price:0,seatRows:0,seatsPerRow:0,formSchema:[{id:"question-1",label:"닉네임",type:"text",required:true,options:[]}]}}>
        <TextInput
          source="title"
          label="행사명"
          validate={required()}
          fullWidth
        />
        <DateTimeInput source="date" label="일시" validate={required()} />
        <TextInput source="place" label="장소" validate={required()} />
        <DateTimeInput source="bookingOpenAt" label="예매 시작" helperText="비워 두면 등록 즉시 예매를 받습니다." />
        <DateTimeInput source="bookingCloseAt" label="예매 마감" helperText="비워 두면 행사 상태를 마감으로 바꿀 때까지 열립니다." />
        <DateTimeInput source="publishAt" label="행사 페이지 공개 시작" helperText="이 시각 전에는 행사·예약 화면에 노출되지 않습니다." />
        <DateTimeInput source="hideAt" label="행사 페이지 공개 종료" helperText="비워 두면 계속 노출됩니다." />
        <DateTimeInput source="qrRevealAt" label="티켓 QR 공개 시각" helperText="이 시각 전에는 티켓만 보이고 QR은 숨겨집니다." />
        <SelectInput source="bookingType" label="예매 방식" choices={[{id:"general",name:"일반 신청"},{id:"assigned_seat",name:"지정 좌석 예매"}]} />
        <NumberInput source="capacity" label="정원" min={1} />
        <NumberInput source="price" label="티켓 가격" min={0} helperText="무료 행사는 0원으로 입력하세요." />
        <FormDataConsumer>{({formData})=>formData.bookingType==="assigned_seat"?<><NumberInput source="seatRows" label="좌석 행 수" min={0} helperText="A행부터 자동 생성됩니다."/><NumberInput source="seatsPerRow" label="행당 좌석 수" min={0} helperText="예: 8행 × 12석"/><TextInput source="blockedSeats" label="사용하지 않는 좌석" fullWidth helperText="A1, A2처럼 쉼표로 구분하세요." format={(value:unknown)=>Array.isArray(value)?value.join(", "):String(value||"")} parse={(value:string)=>value.split(",").map(item=>item.trim().toUpperCase()).filter(Boolean)}/><SeatLayoutInput source="seatLayout"/></>:null}</FormDataConsumer>
        <TextInput source="summary" label="소개" multiline rows={4} fullWidth />
        <TextInput source="imageUrl" label="행사 이미지 URL" fullWidth />
        <TextInput source="videoUrl" label="행사 영상 URL" fullWidth helperText="YouTube 또는 직접 재생 가능한 영상 링크" />
        <TextInput source="timeSlots" label="상영·행사 시간대" multiline rows={6} fullWidth format={formatEventTimeSlots} parse={parseEventTimeSlots} helperText="시간대ID | 표시명 | 시작일시 | 종료일시 | 정원 형식으로 한 줄씩 입력하세요." />
        <TextInput source="managerEmails" label="행사 담당자 이메일" fullWidth format={commaListFormat} parse={commaListParse} helperText="가입 이메일을 쉼표로 구분합니다. 행사 당일 QR 스캐너를 사용할 수 있습니다." />
        <TextInput source="managerUids" label="행사 담당자 UID" fullWidth format={commaListFormat} parse={commaListParse} helperText="필요한 경우 UID도 쉼표로 구분합니다." />
        <TextInput source="formSchema" label="신청 질문" multiline rows={8} fullWidth format={formatEventQuestions} parse={parseEventQuestions} helperText="질문 | 형태 | required/optional | 선택지 형식으로 한 줄씩 입력하세요." />
        <SelectInput
          source="status"
          label="상태"
          choices={[
            { id: "open", name: "접수 중" },
            { id: "closed", name: "마감" },
          ]}
        />
      </SimpleForm>
  );
}
function EventEdit() {
  return (
    <Edit>
      <EventForm />
    </Edit>
  );
}
function EventCreate() {
  return <Create><EventForm /></Create>;
}
function PopupList(){return <List sort={{field:"createdAt",order:"DESC"}}><Datagrid rowClick="edit"><BooleanField source="active" label="사용"/><TextField source="title" label="팝업 제목"/><DateField source="publishAt" label="공개 시작" showTime/><DateField source="hideAt" label="공개 종료" showTime/><EditButton/><DeleteButton/></Datagrid></List>}
function PopupForm(){return <SimpleForm defaultValues={{active:true,dismissible:true}}><TextInput source="title" label="팝업 제목" validate={required()} fullWidth/><TextInput source="summary" label="짧은 안내" multiline rows={3} fullWidth/><TextInput source="imageUrl" label="이미지 URL" fullWidth/><TextInput source="videoUrl" label="영상 URL" fullWidth/><TextInput source="linkUrl" label="이동 링크" fullWidth/><TextInput source="linkLabel" label="링크 버튼 문구"/><DateTimeInput source="publishAt" label="공개 시작"/><DateTimeInput source="hideAt" label="공개 종료"/><BooleanInput source="active" label="팝업 사용"/><BooleanInput source="dismissible" label="사용자 닫기 허용"/><RichTextInput label="팝업 내용"/></SimpleForm>}
function PopupCreate(){return <Create><PopupForm/></Create>}
function PopupEdit(){return <Edit><PopupForm/></Edit>}
function FeaturePageList(){return <List sort={{field:"order",order:"ASC"}}><Datagrid rowClick="edit"><BooleanField source="active" label="공개"/><BooleanField source="showInMenu" label="메뉴"/><BooleanField source="showOnHome" label="홈 홍보"/><TextField source="menuLabel" label="메뉴명"/><TextField source="title" label="이벤트 페이지 제목"/><TextField source="slug" label="주소 키"/><DateField source="publishAt" label="공개 시작" showTime/><DateField source="hideAt" label="공개 종료" showTime/><EditButton/><DeleteButton/></Datagrid></List>}
function FeaturePageForm(){return <SimpleForm defaultValues={{active:true,showInMenu:true,showOnHome:true,order:0,buttonAlignment:"left",scheduleItems:[],actionButtons:[]}}>
  <TextInput source="title" label="이벤트 페이지 제목" validate={required()} fullWidth/>
  <TextInput source="menuLabel" label="메뉴 탭 이름" validate={required()} helperText="상단 메뉴와 이벤트 페이지 목록에 표시됩니다."/>
  <TextInput source="slug" label="주소 키" validate={required()} helperText="영문·숫자·하이픈 권장. /special?slug=주소키로 열립니다."/>
  <FormDataConsumer>{({formData})=>formData.slug?<a className="event-page-preview-link" href={`/special?slug=${encodeURIComponent(String(formData.slug))}`} target="_blank" rel="noreferrer">현재 이벤트 페이지 미리보기 ↗</a>:null}</FormDataConsumer>
  <TextInput source="summary" label="홈·이벤트 목록용 소개" multiline rows={3} fullWidth/>
  <TextInput source="coverImageUrl" label="대표 이미지 URL" fullWidth/>
  <TextInput source="themeColor" label="페이지 강조 색상" helperText="예: #e85f7d"/>
  <TextInput source="videoUrl" label="영상 URL" fullWidth/>
  <TextInput source="eventId" label="연결할 예약 행사 ID" fullWidth helperText="입력하면 이 페이지에서 행사 신청·예매 버튼을 자동 표시합니다."/>
  <DateTimeInput source="eventStartAt" label="D-Day 기준 일시" helperText="행사 시작 시각을 입력하면 페이지에 실시간 D-Day가 표시됩니다."/>
  <DateTimeInput source="publishAt" label="일반 공개 시작" helperText="이 시각 전에는 일반 사용자에게 표시되지 않습니다."/>
  <DateTimeInput source="hideAt" label="일반 공개 종료" helperText="이 시각부터 메뉴·홈·이벤트 목록과 전용 페이지에서 숨겨집니다."/>
  <BooleanInput source="active" label="페이지 공개"/>
  <BooleanInput source="showInMenu" label="상단 메뉴에 표시"/>
  <BooleanInput source="showOnHome" label="홈 화면에서 홍보"/>
  <NumberInput source="order" label="메뉴·홍보 순서" min={0}/>
  <SelectInput source="buttonAlignment" label="버튼 정렬" choices={[{id:"left",name:"왼쪽"},{id:"center",name:"가운데"},{id:"right",name:"오른쪽"}]}/>
  <ArrayInput source="scheduleItems" label="일정표"><SimpleFormIterator inline><DateTimeInput source="startAt" label="시작"/><DateTimeInput source="endAt" label="종료"/><TextInput source="title" label="일정명" validate={required()}/><TextInput source="description" label="설명"/><TextInput source="place" label="장소"/></SimpleFormIterator></ArrayInput>
  <ArrayInput source="actionButtons" label="링크 버튼"><SimpleFormIterator inline><TextInput source="label" label="버튼 문구" validate={required()}/><TextInput source="url" label="링크" validate={required()}/><SelectInput source="kind" label="용도" choices={[{id:"recruit",name:"모집"},{id:"survey",name:"수요조사"},{id:"apply",name:"신청"},{id:"link",name:"일반 링크"}]}/><SelectInput source="placement" label="위치" choices={[{id:"hero",name:"상단 배너"},{id:"content",name:"본문 아래"}]}/><SelectInput source="style" label="모양" choices={[{id:"primary",name:"강조"},{id:"outline",name:"외곽선"}]}/></SimpleFormIterator></ArrayInput>
  <RichTextInput label="페이지 본문"/>
</SimpleForm>}
function FeaturePageCreate(){return <Create><FeaturePageForm/></Create>}
function FeaturePageEdit(){return <Edit><FeaturePageForm/></Edit>}
function MovieWatchList(){return <List sort={{field:"title",order:"ASC"}}><Datagrid rowClick="edit"><BooleanField source="active" label="감시"/><TextField source="title" label="알림 주제"/><TextField source="movieCode" label="롯데 영화 코드"/><NumberField source="monitorDays" label="확인 일수"/><EditButton/><DeleteButton/></Datagrid></List>}
function MovieWatchForm(){return <SimpleForm defaultValues={{active:true,topicId:"k-on-movie-2026",title:"케이온 재재재개봉",movieCode:"22284",searchKeywords:"케이온,K-On!",cinemaIds:"1016,1004,1005,1003,1008,1015",monitorDays:8,pageSlug:"k-on-movie-2026",bookingUrl:"https://www.lottecinema.co.kr/NLCHS/Ticketing?movieCd=22284&movieName=%EC%BC%80%EC%9D%B4%EC%98%A8",benefitSourceUrls:"https://www.lottecinema.co.kr/NLCHS/Event/EventTemplateInfo?eventId=201010016926683",benefitSoldOutKeywords:"소진,매진,증정 종료",benefitWeeks:"week-1|1주차 특전"}}><TextInput source="topicId" label="알림 식별자" validate={required()} helperText="기본값을 유지하세요."/><TextInput source="title" label="알림 주제" validate={required()} fullWidth/><TextInput source="movieCode" label="롯데시네마 영화 코드" validate={required()} helperText="이번 케이온 재재재개봉 코드는 22284입니다."/><TextInput source="searchKeywords" label="영화명 검색어" fullWidth helperText="쉼표로 구분합니다."/><TextInput source="cinemaIds" label="기본 감시 지점 코드" fullWidth helperText="쉼표로 구분. 월드타워 1016, 건대입구 1004, 홍대입구 1005, 노원 1003, 청량리 1008, 신도림 1015"/><NumberInput source="monitorDays" label="오늘부터 확인할 날짜 수" min={1} max={14}/><TextInput source="bookingUrl" label="공식 예매 링크" fullWidth/><TextInput source="benefitSourceUrls" label="공식 특전 공지 URL" multiline rows={4} fullWidth helperText="한 줄에 하나씩 입력하면 공지 내용 변화를 함께 감지합니다."/><TextInput source="benefitSoldOutKeywords" label="특전 소진 감지 문구" fullWidth helperText="쉼표로 구분합니다."/><TextInput source="benefitWeeks" label="주차별 특전 목록" multiline rows={4} fullWidth helperText="week-1|1주차 특전 형식으로 한 줄씩 입력합니다. 받음 인원은 각 키별로 집계됩니다."/><TextInput source="pageSlug" label="연결 페이지 주소 키"/><BooleanInput source="active" label="자동 감시 사용"/></SimpleForm>}
function MovieWatchCreate(){return <Create><MovieWatchForm/></Create>}
function MovieWatchEdit(){return <Edit><MovieWatchForm/></Edit>}
function BenefitReportList(){return <List sort={{field:"createdAt",order:"DESC"}}><Datagrid rowClick="edit"><TextField source="cinemaName" label="지점"/><TextField source="showDate" label="관람일"/><TextField source="showTime" label="회차"/><TextField source="benefitName" label="특전"/><TextField source="status" label="상태"/><DateField source="createdAt" label="제보 시각" showTime/><EditButton/><DeleteButton/></Datagrid></List>}
function BenefitReportEdit(){return <Edit><SimpleForm><TextInput source="cinemaName" label="지점" disabled/><TextInput source="showDate" label="관람일" disabled/><TextInput source="showTime" label="회차" disabled/><TextInput source="benefitName" label="특전" disabled fullWidth/><TextInput source="ticketProofUrl" label="티켓 인증 이미지 링크" disabled fullWidth/><TextInput source="comment" label="현장 메모" multiline rows={4} disabled fullWidth/><SelectInput source="status" label="확인 상태" choices={[{id:"reported",name:"제보됨"},{id:"verified",name:"관리자 확인"},{id:"rejected",name:"허위·확인 불가"}]}/></SimpleForm></Edit>}
function BenefitReceiptList(){return <List sort={{field:"createdAt",order:"DESC"}}><Datagrid rowClick="edit"><TextField source="benefitLabel" label="주차별 특전"/><TextField source="cinemaName" label="지점"/><TextField source="showDate" label="관람일"/><TextField source="showTime" label="회차"/><TextField source="status" label="상태"/><DateField source="createdAt" label="등록 시각" showTime/><EditButton/><DeleteButton/></Datagrid></List>}
function BenefitReceiptEdit(){return <Edit><SimpleForm><TextInput source="benefitLabel" label="주차별 특전" disabled fullWidth/><TextInput source="cinemaName" label="지점" disabled/><TextInput source="showDate" label="관람일" disabled/><TextInput source="showTime" label="회차" disabled/><TextInput source="ticketProofUrl" label="관람 인증 이미지 링크" disabled fullWidth/><SelectInput source="status" label="확인 상태" choices={[{id:"reported",name:"등록됨"},{id:"verified",name:"관리자 확인"},{id:"rejected",name:"허위·확인 불가"}]}/></SimpleForm></Edit>}
function InquiryList() {
  return (
    <List filters={searchFilters} sort={{ field: "createdAt", order: "DESC" }}>
      <Datagrid rowClick="edit">
        <EmailField source="userEmail" label="회원" />
        <TextField source="category" label="분류" />
        <TextField source="title" label="제목" />
        <TextField source="status" label="상태" />
        <DateField source="createdAt" label="작성일" />
        <EditButton />
      </Datagrid>
    </List>
  );
}
function InquiryEdit() {
  return (
    <Edit>
      <SimpleForm>
        <TextInput source="userId" label="회원 UID" disabled fullWidth />
        <TextInput source="userEmail" label="회원" disabled fullWidth />
        <TextInput source="title" label="제목" disabled fullWidth />
        <TextInput
          source="body"
          label="문의 내용"
          disabled
          multiline
          rows={7}
          fullWidth
        />
        <TextInput source="attachmentName" label="첨부 이름" disabled />
        <TextInput source="attachmentUrl" label="첨부 링크" disabled fullWidth />
        <RichTextInput label="관리자 답변" source="answerRich" plainSource="answer" />
        <SelectInput
          source="status"
          label="상태"
          choices={[
            { id: "waiting", name: "답변 대기" },
            { id: "answered", name: "답변 완료" },
            { id: "canceled", name: "문의 취소" },
          ]}
        />
      </SimpleForm>
    </Edit>
  );
}
function InquiryCategoryList() {
  const refresh=useRefresh(),notify=useNotify();
  useEffect(()=>{if(!db)return;const firestore=db;let active=true;(async()=>{try{const marker=doc(firestore,"inquiryCategorySettings","main"),markerSnapshot=await getDoc(marker);if(markerSnapshot.exists())return;const existing=await getDocs(collection(firestore,"inquiryCategories")),existingIds=new Set(existing.docs.map(item=>item.id)),batch=writeBatch(firestore);[{id:"event",label:"행사",description:"행사 일정과 운영 문의",order:10},{id:"reservation",label:"예약",description:"예약·예매 신청 문의",order:20},{id:"site",label:"사이트 이용",description:"계정과 사이트 이용 문의",order:30},{id:"etc",label:"기타",description:"기타 문의",order:40}].filter(item=>!existingIds.has(item.id)).forEach(item=>batch.set(doc(firestore,"inquiryCategories",item.id),{label:item.label,description:item.description,order:item.order,active:true,createdAt:new Date().toISOString()}));batch.set(marker,{initialized:true,initializedAt:new Date().toISOString()});await batch.commit();if(active)refresh();}catch(error){if(active)notify(error instanceof Error?error.message:"기본 문의 카테고리를 등록하지 못했습니다.",{type:"error"});}})();return()=>{active=false;};},[notify,refresh]);
  return (
    <List sort={{ field: "order", order: "ASC" }}>
      <Datagrid rowClick="edit">
        <TextField source="label" label="카테고리" />
        <TextField source="description" label="설명" />
        <BooleanField source="active" label="사용" />
        <NumberField source="order" label="순서" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}
function InquiryCategoryForm() {
  return (
    <SimpleForm>
      <TextInput
        source="label"
        label="카테고리명"
        validate={required()}
        fullWidth
      />
      <TextInput source="description" label="설명" fullWidth />
      <BooleanInput source="active" label="사용" defaultValue={true} />
      <NumberInput source="order" label="표시 순서" min={0} defaultValue={0} />
    </SimpleForm>
  );
}
function InquiryCategoryEdit() {
  return (
    <Edit>
      <InquiryCategoryForm />
    </Edit>
  );
}
function InquiryCategoryCreate() {
  return (
    <Create>
      <InquiryCategoryForm />
    </Create>
  );
}
function ReservationList() {
  return (
    <List filters={searchFilters} sort={{ field: "createdAt", order: "DESC" }}>
      <Datagrid rowClick="edit">
        <EmailField source="userEmail" label="회원" />
        <TextField source="eventTitle" label="행사" />
        <TextField source="timeSlotLabel" label="시간대" />
        <TextField source="seatLabel" label="좌석" />
        <TextField source="status" label="상태" />
        <DateField source="createdAt" label="신청일" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}
function ReservationEdit() {
  return (
    <Edit>
      <SimpleForm>
        <TextInput source="userId" label="회원 UID" disabled fullWidth />
        <TextInput source="userEmail" label="회원" disabled fullWidth />
        <TextInput source="eventTitle" label="행사" disabled fullWidth />
        <TextInput source="timeSlotLabel" label="시간대" disabled fullWidth />
        <TextInput source="seatLabel" label="배정 좌석" disabled />
        <TextInput source="ticketCode" label="티켓 코드" disabled fullWidth />
        <DateTimeInput source="checkInAt" label="입장 처리 시각" disabled />
        <TextInput source="answers" label="신청 답변" disabled multiline rows={6} fullWidth format={(value:unknown)=>typeof value==="object"&&value?Object.entries(value as Record<string,unknown>).map(([key,answer])=>`${key}: ${String(answer)}`).join("\n"):String(value||"")} />
        <SelectInput
          source="status"
          label="진행 상태"
          choices={[
            { id: "received", name: "접수" },
            { id: "reviewing", name: "검토 중" },
            { id: "confirmed", name: "확정" },
            { id: "completed", name: "안내 완료" },
            { id: "canceled", name: "취소" },
          ]}
        />
      </SimpleForm>
    </Edit>
  );
}
function AccountMessageList(){
  return <List filters={searchFilters} sort={{field:"createdAt",order:"DESC"}}><Datagrid rowClick="edit"><EmailField source="userEmail" label="회원"/><TextField source="title" label="제목"/><BooleanField source="read" label="읽음"/><DateField source="createdAt" label="발송일" showTime/><EditButton/><DeleteButton/></Datagrid></List>;
}
function AccountMessageForm(){
  return <SimpleForm defaultValues={{read:false,url:"/mypage"}}><TextInput source="userId" label="회원 UID" validate={required()} fullWidth helperText="예약 상세 화면의 사용자 UID를 입력하세요."/><TextInput source="userEmail" label="회원 이메일" fullWidth/><TextInput source="title" label="제목" validate={required()} fullWidth/><TextInput source="body" label="내용" validate={required()} multiline rows={6} fullWidth/><TextInput source="url" label="연결 주소" fullWidth/><BooleanInput source="read" label="읽음 처리"/></SimpleForm>;
}
function AccountMessageCreate(){return <Create><AccountMessageForm/></Create>}
function AccountMessageEdit(){return <Edit><AccountMessageForm/></Edit>}
function AdminNoticeList(){
  return <List filters={searchFilters} sort={{field:"createdAt",order:"DESC"}}><Datagrid rowClick="edit"><TextField source="audiences" label="대상"/><TextField source="title" label="제목"/><DateField source="createdAt" label="작성일" showTime/><EditButton/><DeleteButton/></Datagrid></List>;
}
function AdminNoticeForm(){
  return <SimpleForm><TextInput source="audiences" label="대상 권한" validate={required()} fullWidth helperText="all, design, events, notices, applications, users 중 쉼표로 구분" format={(value:unknown)=>Array.isArray(value)?value.join(", "):String(value||"")} parse={(value:string)=>value.split(",").map(item=>item.trim()).filter(Boolean)}/><TextInput source="title" label="제목" validate={required()} fullWidth/><RichTextInput label="내용"/></SimpleForm>;
}
function AdminNoticeCreate(){return <Create><AdminNoticeForm/></Create>}
function AdminNoticeEdit(){return <Edit><AdminNoticeForm/></Edit>}
function AdminList() {
  return (
    <List sort={{ field: "updatedAt", order: "DESC" }}>
      <Datagrid>
        <EmailField source="email" label="관리자" />
        <TextField source="permissions" label="권한" />
        <BooleanField source="active" label="활성" />
        <DateField source="updatedAt" label="변경일" showTime />
      </Datagrid>
    </List>
  );
}
function MemberList(){
  const label=(title:string,description:string)=><span className="member-column-label"><b>{title}</b><small>{description}</small></span>;
  return <List filters={searchFilters} sort={{field:"joinedAt",order:"DESC"}}><Datagrid bulkActionButtons={false}><TextField source="id" label={label("UID","Firebase 회원 고유값")}/><EmailField source="email" label={label("이메일","로그인 계정")}/><TextField source="nickname" label={label("닉네임","사이트 표시 이름")} emptyText="미등록"/><NumberField source="memberNumber" label={label("가입 순번","가입한 순서")}/><NumberField source="points" label={label("포인트","현재 보유 포인트")} emptyText="0"/><DateField source="joinedAt" label={label("가입일","최초 가입 시각")} showTime/><DateField source="nicknameChangedAt" label={label("프로필 변경","닉네임 변경 시각")} showTime/></Datagrid></List>;
}
function PointHistoryList(){
  return <List filters={searchFilters} sort={{field:"createdAt",order:"DESC"}}><Datagrid><EmailField source="userEmail" label="회원"/><NumberField source="delta" label="변동"/><NumberField source="balance" label="잔액"/><TextField source="reason" label="사유"/><DateField source="createdAt" label="처리일" showTime/></Datagrid></List>;
}
function SeatLayoutList(){
  return <List sort={{field:"createdAt",order:"DESC"}}><Datagrid rowClick="edit"><TextField source="name" label="배치명"/><NumberField source="layout.rows" label="행"/><NumberField source="layout.columns" label="열"/><DateField source="createdAt" label="저장일" showTime/><EditButton/><DeleteButton/></Datagrid></List>;
}
function SeatLayoutForm(){return <SimpleForm><TextInput source="name" label="배치명" validate={required()} fullWidth/><SeatLayoutInput source="layout"/></SimpleForm>}
function SeatLayoutCreate(){return <Create><SeatLayoutForm/></Create>}
function SeatLayoutEdit(){return <Edit><SeatLayoutForm/></Edit>}
function AdList() {
  return (
    <List sort={{ field: "createdAt", order: "DESC" }}>
      <Datagrid rowClick="edit">
        <BooleanField source="active" label="노출" />
        <TextField source="slot" label="위치" />
        <TextField source="label" label="라벨" />
        <TextField source="title" label="제목" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}
function AdForm() {
  return (
    <SimpleForm defaultValues={{active:true,slot:"after-hub",label:"PARTNER"}}>
      <BooleanInput source="active" label="광고 노출" />
      <SelectInput
        source="slot"
        label="노출 위치"
        validate={required()}
        choices={[
          { id: "after-hub", name: "둘러보기 다음" },
          { id: "after-community", name: "커뮤니티 다음" },
        ]}
      />
      <TextInput source="label" label="작은 라벨" />
      <TextInput
        source="title"
        label="광고 제목"
        validate={required()}
        fullWidth
      />
      <TextInput source="body" label="광고 설명" multiline rows={3} fullWidth />
      <TextInput
        source="href"
        label="연결 주소"
        helperText="외부 링크 또는 /events 같은 내부 경로"
        fullWidth
      />
      <TextInput
        source="imageUrl"
        label="이미지 URL"
        helperText="외부에 올린 이미지의 직접 링크를 입력하세요."
        fullWidth
      />
    </SimpleForm>
  );
}
function AdEdit() {
  return (
    <Edit>
      <AdForm />
    </Edit>
  );
}
function AdCreate() {
  return (
    <Create>
      <AdForm />
    </Create>
  );
}
function ProductList() {
  return (
    <List sort={{ field: "createdAt", order: "DESC" }}>
      <Datagrid rowClick="edit">
        <BooleanField source="active" label="판매" />
        <TextField source="shopId" label="상점" />
        <TextField source="name" label="상품명" />
        <NumberField source="price" label="가격" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}
function ProductShopSelect({lockedShopId=""}:{lockedShopId?:string}){const {data=[],isPending}=useGetList("shops",{pagination:{page:1,perPage:100},sort:{field:"order",order:"ASC"}}),{getValues,setValue}=useFormContext();const choices=data.map(shop=>({id:String(shop.id),name:String(shop.name||shop.id)}));useEffect(()=>{const nextShopId=lockedShopId||String(choices[0]?.id||"");if(nextShopId&&!getValues("shopId"))setValue("shopId",nextShopId,{shouldDirty:false});},[choices,getValues,lockedShopId,setValue]);return <SelectInput source="shopId" label="판매 상점" choices={choices} validate={required()} isPending={isPending} readOnly={Boolean(lockedShopId)} helperText={lockedShopId?"상점 페이지에서 선택된 상점으로 등록됩니다.":"상품을 등록할 상점을 선택하세요."} fullWidth/>;}
function ProductForm() {
  const location=useLocation();
  const lockedShopId=new URLSearchParams(location.search).get("shopId")||"";
  return (
    <SimpleForm defaultValues={{active:true,rewardMode:"default",rewardPoints:0,...(lockedShopId?{shopId:lockedShopId}:{})}}>
      <ProductShopSelect lockedShopId={lockedShopId} />
      <BooleanInput source="active" label="판매 노출" defaultValue={true} />
      <TextInput source="name" label="상품명" validate={required()} fullWidth />
      <TextInput
        source="description"
        label="설명"
        multiline
        rows={3}
        fullWidth
      />
      <NumberInput source="price" label="가격" min={0} />
      <SelectInput source="rewardMode" label="구매 포인트" choices={[{id:"default",name:"관리자 가격별 기본 설정"},{id:"fixed",name:"상품별 고정 포인트"},{id:"none",name:"포인트 미지급"}]} />
      <FormDataConsumer>{({formData})=>formData.rewardMode==="fixed"?<NumberInput source="rewardPoints" label="상품 구매 완료 지급 포인트" min={0}/>:null}</FormDataConsumer>
      <TextInput source="imageUrl" label="이미지 URL" fullWidth />
      <TextInput source="bankName" label="상품별 은행명" helperText="입력하면 이 상품 주문에만 적용됩니다." fullWidth />
      <TextInput source="accountNumber" label="상품별 계좌번호" helperText="비워 두면 상점 공통 입금 계좌를 사용합니다." fullWidth />
      <TextInput source="accountHolder" label="상품별 예금주" fullWidth />
    </SimpleForm>
  );
}
function ProductEdit() {
  return (
    <Edit>
      <ProductForm />
    </Edit>
  );
}
function OrderList() {
  return <List filters={searchFilters} sort={{ field: "createdAt", order: "DESC" }}><Datagrid rowClick="edit"><EmailField source="userEmail" label="구매자" /><TextField source="productName" label="상품" /><NumberField source="amount" label="금액" /><TextField source="depositorName" label="입금자명" /><TextField source="status" label="상태" /><DateField source="createdAt" label="주문일" showTime /><EditButton /></Datagrid></List>;
}
function OrderEdit() {
  return <Edit><SimpleForm><TextInput source="userEmail" label="구매자" disabled fullWidth /><TextInput source="productName" label="상품" disabled fullWidth /><NumberInput source="amount" label="금액" disabled /><TextInput source="depositorName" label="입금자명" disabled /><SelectInput source="status" label="처리 상태" choices={[{ id: "awaiting_transfer", name: "입금 대기" }, { id: "payment_reported", name: "입금 확인 중" }, { id: "payment_confirmed", name: "결제 승인" }, { id: "fulfilling", name: "상품 전달 중" }, { id: "delivered", name: "상품 전달 완료 · 포인트 확정" }, { id: "payment_rejected_refund_pending", name: "입금 거절 · 환불 예정" }, { id: "refund_requested", name: "환불 신청 검토 중" }, { id: "refund_rejected", name: "환불 신청 거절" }, { id: "refund_approved", name: "환불 진행 중" }, { id: "refunded", name: "환불 완료" }, { id: "canceled", name: "주문 취소" }]} /><NumberInput source="pointsAwarded" label="최종 지급 포인트" disabled/><TextInput source="buyerRefundReason" label="구매자 환불 신청 사유" disabled multiline rows={3} fullWidth /><TextInput source="adminRefundReason" label="관리자 처리/거절 사유" multiline rows={4} fullWidth helperText="입금 거절 또는 구매자 환불 신청 거절 시 반드시 사유를 작성하세요." /></SimpleForm></Edit>;
}
function ShopSettingsEdit() {
  return <Edit><SimpleForm><TextInput source="bankName" label="은행명" validate={required()} /><TextInput source="accountNumber" label="계좌번호" validate={required()} fullWidth /><TextInput source="accountHolder" label="예금주" validate={required()} /></SimpleForm></Edit>;
}
function ShopSettingsList() {
  return <List pagination={false}><Datagrid rowClick="edit"><TextField source="bankName" label="은행" /><TextField source="accountNumber" label="계좌번호" /><TextField source="accountHolder" label="예금주" /><EditButton /><DeleteButton /></Datagrid></List>;
}
function ShopSettingsCreate() {
  return <Create><SimpleForm><TextInput source="bankName" label="은행명" validate={required()} /><TextInput source="accountNumber" label="계좌번호" validate={required()} fullWidth /><TextInput source="accountHolder" label="예금주" validate={required()} /></SimpleForm></Create>;
}
function ProductCreate() {
  return (
    <Create>
      <ProductForm />
    </Create>
  );
}
function ShopList(){const {permissions=[]}=usePermissions<string[]>();const canEdit=permissions.includes("owner")||permissions.includes("design");return <List sort={{field:"order",order:"ASC"}} pagination={false}><Datagrid rowClick={canEdit?"edit":false}><BooleanField source="active" label="노출"/><TextField source="name" label="상점명"/><TextField source="description" label="소개"/><TextField source="bankName" label="은행"/><NumberField source="order" label="순서"/><FunctionField label="상품 등록" render={record=><Link className="shop-product-create" to={`/products/create?shopId=${encodeURIComponent(String(record.id))}`}>상품 등록</Link>}/>{canEdit&&<EditButton/>}{canEdit&&<DeleteButton/>}</Datagrid></List>}
const formatManagerEmails=(value:unknown)=>Array.isArray(value)?value.join("\n"):String(value||"");
const parseManagerEmails=(value:string)=>Array.from(new Set(value.split(/[\n,]/).map(item=>item.trim().toLowerCase()).filter(Boolean)));
function ShopForm(){return <SimpleForm defaultValues={{active:true,order:10,managerEmails:[]}}><BooleanInput source="active" label="상점 노출"/><TextInput source="name" label="상점명" validate={required()} fullWidth/><TextInput source="description" label="상점 소개" multiline rows={3} fullWidth/><TextInput source="imageUrl" label="상점 대표 이미지 URL" fullWidth/><NumberInput source="order" label="노출 순서" min={0}/><TextInput source="bankName" label="은행명"/><TextInput source="accountNumber" label="계좌번호" fullWidth/><TextInput source="accountHolder" label="예금주"/><TextInput source="managerEmails" label="상품 담당자 이메일" format={formatManagerEmails} parse={parseManagerEmails} multiline rows={4} fullWidth helperText="한 줄에 하나씩 입력하세요. 관리자 권한에서 ‘상점 담당’ 권한도 함께 부여해야 이 상점의 상품을 관리할 수 있습니다."/></SimpleForm>}
function ShopCreate(){return <Create><ShopForm/></Create>}
function ShopEdit(){return <Edit><ShopForm/></Edit>}
type SiteDesignState={siteName:string;logoUrl:string;fontFamily:string;accentColor:string;heroEyebrow:string;heroTitle:string;heroDescription:string;heroImages:string;characterImages:string;communityMessage:string};
const SITE_FONT_CHOICES=[
  {id:'"Pretendard", "Noto Sans KR", system-ui, sans-serif',name:"기본 · Pretendard"},
  {id:'"Noto Sans KR", sans-serif',name:"Noto Sans KR"},
  {id:'system-ui, sans-serif',name:"시스템 고딕"},
  {id:'"Noto Serif KR", Georgia, serif',name:"Noto Serif KR · 명조"},
  {id:'Georgia, "Times New Roman", serif',name:"Georgia · 세리프"},
  {id:'"Dongle", "Noto Sans KR", sans-serif',name:"Dongle · 귀여운 둥근 글꼴"},
  {id:'"Gaegu", cursive',name:"Gaegu · 귀여운 필기체"},
  {id:'"Hi Melody", cursive',name:"Hi Melody · 부드러운 손글씨"},
  {id:'"Nanum Pen Script", cursive',name:"나눔펜 · 펜글씨"},
  {id:'"Poor Story", cursive',name:"Poor Story · 자연스러운 손글씨"},
];
const DEFAULT_SITE_DESIGN:SiteDesignState={siteName:"K-ON! FANDOM KR",logoUrl:DEFAULT_K_ON_LOGO,fontFamily:'"Pretendard", "Noto Sans KR", system-ui, sans-serif',accentColor:"#ff4f6d",heroEyebrow:"AFTER SCHOOL, TOGETHER",heroTitle:"좋아하는 음악으로\n다시 만나는 우리",heroDescription:"K-ON!의 음악과 일상을 함께 기억하고 새로운 순간을 만드는 한국 팬 커뮤니티.",heroImages:"/hero-music-room.png",characterImages:DEFAULT_CHARACTER_IMAGE_LINES,communityMessage:"좋아하는 마음은 시간이 지나도 계속 연주됩니다."};
function SiteSettingsList() {
  const [values,setValues]=useState(DEFAULT_SITE_DESIGN),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const notify=useNotify();
  useEffect(()=>{if(!db){setLoading(false);return;}return onSnapshot(doc(db,"siteSettings","main"),snapshot=>{const data=snapshot.data()||{};const savedCharacters=Array.isArray(data.characterImages)?data.characterImages:[];setValues({...DEFAULT_SITE_DESIGN,...data,logoUrl:String(data.logoUrl||DEFAULT_K_ON_LOGO),heroImages:Array.isArray(data.heroImages)&&data.heroImages.length?data.heroImages.join("\n"):String(data.heroImages||DEFAULT_SITE_DESIGN.heroImages),characterImages:savedCharacters.length?savedCharacters.map((item:unknown)=>typeof item==="object"&&item?`${String((item as {name?:unknown}).name||"")} | ${String((item as {url?:unknown}).url||"")} | ${String((item as {source?:unknown}).source||"")}`:String(item)).join("\n"):DEFAULT_CHARACTER_IMAGE_LINES});setLoading(false);},()=>{setLoading(false);notify("사이트 디자인 설정을 불러오지 못했습니다.",{type:"error"});});},[notify]);
  const change=(key:keyof SiteDesignState)=>(value:string)=>setValues(current=>({...current,[key]:value}));
  function resetToDefaults(){setValues({...DEFAULT_SITE_DESIGN});notify("기본 디자인 값을 폼에 불러왔습니다. 아직 적용되지 않았으며, 저장 버튼을 눌러야 반영됩니다.",{type:"info"});}
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!db)return notify("Firebase가 연결되지 않았습니다.",{type:"error"});setSaving(true);try{const heroImages=values.heroImages.split("\n").map(item=>item.trim()).filter(Boolean),parsedCharacters=values.characterImages.split("\n").map(item=>item.trim()).filter(Boolean).map(item=>{const [name,url,source]=item.split("|").map(part=>part.trim());return{name,url,source};}).filter(item=>item.name&&item.url),characterImages=parsedCharacters.length?parsedCharacters:DEFAULT_CHARACTER_IMAGES;await setDoc(doc(db,"siteSettings","main"),{...values,logoUrl:values.logoUrl.trim()||DEFAULT_K_ON_LOGO,heroImages,characterImages,updatedAt:new Date().toISOString()},{merge:true});notify("사이트 디자인을 저장했습니다.",{type:"success"});}catch{notify("사이트 디자인 저장에 실패했습니다.",{type:"error"});}finally{setSaving(false);}}
  if(loading)return <section className="site-design-editor"><p>사이트 디자인 설정을 불러오는 중입니다…</p></section>;
  const previewImage=values.heroImages.split("\n").map(item=>item.trim()).find(Boolean);
  const fontChoices=SITE_FONT_CHOICES.some(item=>item.id===values.fontFamily)?SITE_FONT_CHOICES:[...SITE_FONT_CHOICES,{id:values.fontFamily,name:"현재 사용자 지정 글꼴"}];
  return <section className="site-design-editor"><header><small>SITE APPEARANCE</small><h1>사이트 디자인</h1><p>홈페이지의 로고, 글꼴, 색상과 히어로 배너를 여기에서 바로 변경합니다.</p></header><form onSubmit={save}>
    <fieldset><legend>브랜드와 전체 스타일</legend><label>사이트 이름<input value={values.siteName} onChange={event=>change("siteName")(event.target.value)}/></label><label>로고 이미지 URL<input value={values.logoUrl} onChange={event=>change("logoUrl")(event.target.value)} placeholder="https://..."/></label><label>전체 글꼴<select value={values.fontFamily} onChange={event=>change("fontFamily")(event.target.value)}>{fontChoices.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><small>사이트 전체에 적용할 글꼴을 선택하세요.</small></label><label>강조 색상<div className="site-color-control"><input type="color" value={/^#[0-9a-f]{6}$/i.test(values.accentColor)?values.accentColor:"#ff4f6d"} onChange={event=>change("accentColor")(event.target.value)}/><input value={values.accentColor} onChange={event=>change("accentColor")(event.target.value)} placeholder="#ff4f6d"/></div></label></fieldset>
    <fieldset><legend>히어로 배너</legend><label>작은 문구<input value={values.heroEyebrow} onChange={event=>change("heroEyebrow")(event.target.value)}/></label><label>메인 제목<textarea rows={3} value={values.heroTitle} onChange={event=>change("heroTitle")(event.target.value)}/></label><label>설명<textarea rows={3} value={values.heroDescription} onChange={event=>change("heroDescription")(event.target.value)}/></label><label className="wide">배너 이미지 URL<textarea rows={6} value={values.heroImages} onChange={event=>change("heroImages")(event.target.value)} placeholder="이미지 URL을 한 줄에 하나씩 입력"/><small>한 줄에 하나씩 입력합니다. 이미지가 여러 장이면 홈페이지에서 슬라이드됩니다.</small></label>{previewImage&&<div className="site-hero-preview" style={{backgroundImage:`linear-gradient(90deg,rgba(20,13,16,.75),rgba(20,13,16,.2)),url(${previewImage})`}}><small>{values.heroEyebrow}</small><b>{values.heroTitle}</b><span>{values.heroDescription}</span></div>}</fieldset>
    <fieldset><legend>콘텐츠 이미지와 문구</legend><label className="wide">캐릭터 이미지 목록<textarea rows={6} value={values.characterImages} onChange={event=>change("characterImages")(event.target.value)} placeholder="이름 | 이미지 URL | 출처 URL"/><small>이름 | 이미지 URL | 출처 URL 형식으로 한 줄에 한 명씩 입력하세요.</small></label><label className="wide">커뮤니티 문구<input value={values.communityMessage} onChange={event=>change("communityMessage")(event.target.value)}/></label></fieldset>
    <footer><button type="button" className="secondary" disabled={saving} onClick={resetToDefaults}>기본값으로 초기화</button><button type="submit" disabled={saving}>{saving?"저장 중…":"사이트 디자인 저장"}</button></footer>
  </form></section>;
}
function SiteSettingsForm() {
  return (
    <SimpleForm>
        <TextInput source="siteName" label="사이트 이름" fullWidth />
        <TextInput
          source="logoUrl"
          label="로고 이미지 URL"
          fullWidth
          helperText="외부 이미지 또는 Google Drive 공유 링크를 권장합니다."
        />
        <SelectInput
          source="fontFamily"
          label="전체 글꼴"
          choices={SITE_FONT_CHOICES}
          fullWidth
          helperText="사이트 전체에 적용할 글꼴을 선택하세요."
        />
        <TextInput source="accentColor" label="강조 색상" />
        <TextInput source="heroEyebrow" label="히어로 작은 문구" fullWidth />
        <TextInput
          source="heroTitle"
          label="히어로 제목"
          multiline
          rows={2}
          fullWidth
        />
        <TextInput
          source="heroDescription"
          label="히어로 설명"
          multiline
          rows={3}
          fullWidth
        />
        <TextInput
          source="heroImages"
          label="히어로 이미지 URL 목록"
          multiline
          rows={4}
          fullWidth
          format={(value: unknown) =>
            Array.isArray(value) ? value.join("\n") : String(value || "")
          }
          parse={(value: string) =>
            value
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean)
          }
          helperText="URL을 한 줄에 하나씩 입력하세요. 최소 1장, 2장부터 자동 슬라이드됩니다."
        />
        <TextInput
          source="characterImages"
          label="캐릭터 이미지 목록"
          multiline
          rows={6}
          fullWidth
          format={(value: unknown) =>
            Array.isArray(value)
              ? value
                  .map((item) =>
                    typeof item === "object" && item
                      ? `${String((item as { name?: unknown }).name || "")} | ${String((item as { url?: unknown }).url || "")} | ${String((item as { source?: unknown }).source || "")}`.replace(
                          / \| $/,
                          "",
                        )
                      : String(item),
                  )
                  .join("\n")
              : String(value || "")
          }
          parse={(value: string) =>
            value
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean)
              .map((item) => {
                const [name, url, source] = item
                  .split("|")
                  .map((part) => part.trim());
                return { name, url, source };
              })
          }
          helperText="이름 | 이미지 URL | 출처 URL 형식으로 한 줄에 한 명씩 입력하세요."
        />
        <TextInput source="communityMessage" label="커뮤니티 문구" fullWidth />
    </SimpleForm>
  );
}
function SiteSettingsEdit() {
  return (
    <Edit title="사이트 디자인" redirect={false}>
      <SiteSettingsForm />
    </Edit>
  );
}
function ImageHostingSettings(){
  return <section className="image-hosting-settings"><header><small>IMAGE LINK MODE</small><h1>이미지 등록 방식</h1><p>현재는 외부 이미지 링크를 저장하는 방식으로 통일해 동작합니다.</p></header><div className="image-hosting-status ready"><ImagePlus/><div><b>이미지 URL 등록 사용 중</b><small>게시글 편집기의 ‘이미지 URL’ 버튼과 첨부 링크를 사용하세요.</small></div></div><div><p>ImgBB 등의 이미지 호스팅에서 발급된 직접 이미지 URL을 복사해 붙여 넣으면 됩니다. Apps Script 업로더를 추가하더라도 반환된 URL을 같은 필드에 저장하면 됩니다.</p></div></section>;
}
function PointAutomationSettings(){
  const [values,setValues]=useState<Required<PointSettings>>(DEFAULT_POINT_SETTINGS),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const notify=useNotify();
  useEffect(()=>{if(!db){setLoading(false);return;}return onSnapshot(doc(db,"pointSettings","main"),snapshot=>{setValues({...DEFAULT_POINT_SETTINGS,...snapshot.data()});setLoading(false);},()=>{setLoading(false);notify("포인트 설정을 불러오지 못했습니다.",{type:"error"});});},[notify]);
  const number=(key:keyof PointSettings)=>(event:React.ChangeEvent<HTMLInputElement>)=>setValues(current=>({...current,[key]:Number(event.target.value||0)}));
  const datetime=(key:"eventStartAtMs"|"eventEndAtMs")=>(event:React.ChangeEvent<HTMLInputElement>)=>setValues(current=>({...current,[key]:event.target.value?new Date(event.target.value).getTime():0}));
  const localDate=(value:number)=>value?new Date(value-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!db)return;setSaving(true);try{await setDoc(doc(db,"pointSettings","main"),{...values,updatedAt:new Date().toISOString()},{merge:true});notify("포인트 자동 지급 설정을 저장했습니다.",{type:"success"});}catch(error){notify(error instanceof Error?error.message:"포인트 설정 저장에 실패했습니다.",{type:"error"});}finally{setSaving(false);}}
  if(loading)return <section className="image-hosting-settings"><p>포인트 설정을 불러오는 중입니다…</p></section>;
  return <section className="image-hosting-settings"><header><small>AUTOMATIC REWARDS</small><h1>포인트 자동 지급</h1><p>모든 지급은 고유 원장으로 기록되어 같은 가입·공지·추천·주문에는 한 번만 지급됩니다.</p></header><form onSubmit={save}>
    <label><input type="checkbox" checked={values.enabled} onChange={event=>setValues(current=>({...current,enabled:event.target.checked}))}/> 자동 지급 사용</label>
    <label>회원가입 포인트<input type="number" min="0" value={values.signupPoints} onChange={number("signupPoints")}/></label>
    <label>공지 최초 확인 포인트<input type="number" min="0" value={values.noticeReadPoints} onChange={number("noticeReadPoints")}/></label>
    <label>추천인 포인트<input type="number" min="0" value={values.referralInviterPoints} onChange={number("referralInviterPoints")}/></label>
    <label>추천받은 신규 회원 포인트<input type="number" min="0" value={values.referralInviteePoints} onChange={number("referralInviteePoints")}/></label>
    <label>N번째 회원 주기<input type="number" min="0" value={values.memberMilestoneEvery} onChange={number("memberMilestoneEvery")}/><small>예: 100이면 100·200·300번째 회원마다 지급, 0이면 사용 안 함</small></label>
    <label>N번째 회원 추가 포인트<input type="number" min="0" value={values.memberMilestonePoints} onChange={number("memberMilestonePoints")}/></label>
    <label>구매 금액 단위(원)<input type="number" min="1" value={values.purchaseUnitAmount} onChange={number("purchaseUnitAmount")}/></label>
    <label>금액 단위당 포인트<input type="number" min="0" value={values.purchasePointsPerUnit} onChange={number("purchasePointsPerUnit")}/><small>결제 승인 후 상품 전달 완료 상태에서 최종 지급됩니다.</small></label>
    <hr/><label><input type="checkbox" checked={values.eventEnabled} onChange={event=>setValues(current=>({...current,eventEnabled:event.target.checked}))}/> 기간 한정 이벤트로 기존 설정 덮어쓰기</label>
    <label>이벤트 이름<input value={values.eventName} onChange={event=>setValues(current=>({...current,eventName:event.target.value}))}/></label>
    <label>시작<input type="datetime-local" value={localDate(values.eventStartAtMs)} onChange={datetime("eventStartAtMs")}/></label>
    <label>종료<input type="datetime-local" value={localDate(values.eventEndAtMs)} onChange={datetime("eventEndAtMs")}/></label>
    <label>이벤트 가입 포인트<input type="number" min="0" value={values.eventSignupPoints} onChange={number("eventSignupPoints")}/></label>
    <label>이벤트 공지 확인 포인트<input type="number" min="0" value={values.eventNoticeReadPoints} onChange={number("eventNoticeReadPoints")}/></label>
    <label>이벤트 추천인 포인트<input type="number" min="0" value={values.eventReferralInviterPoints} onChange={number("eventReferralInviterPoints")}/></label>
    <label>이벤트 추천 가입 포인트<input type="number" min="0" value={values.eventReferralInviteePoints} onChange={number("eventReferralInviteePoints")}/></label>
    <label>이벤트 N번째 가입 추가 포인트<input type="number" min="0" value={values.eventMemberMilestonePoints} onChange={number("eventMemberMilestonePoints")}/></label>
    <label>이벤트 구매 금액 단위<input type="number" min="1" value={values.eventPurchaseUnitAmount} onChange={number("eventPurchaseUnitAmount")}/></label>
    <label>이벤트 금액 단위당 포인트<input type="number" min="0" value={values.eventPurchasePointsPerUnit} onChange={number("eventPurchasePointsPerUnit")}/></label>
    <button type="submit" disabled={saving}>{saving?"저장 중…":"포인트 설정 저장"}</button>
  </form></section>;
}
function BoardList() {
  return (
    <List sort={{ field: "order", order: "ASC" }}>
      <Datagrid rowClick="edit">
        <TextField source="label" label="이름" />
        <TextField source="key" label="주소 키" />
        <TextField source="collection" label="데이터 컬렉션" />
        <BooleanField source="active" label="노출" />
        <NumberField source="order" label="순서" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}
function BoardForm() {
  return (
    <SimpleForm defaultValues={{ collection: "boardPosts", active: true, order: 10 }}>
      <TextInput
        source="key"
        label="주소 키"
        validate={required()}
        helperText="영문 소문자와 하이픈만 권장"
      />
      <TextInput source="label" label="게시판 이름" validate={required()} />
      <TextInput source="menuLabel" label="메뉴 이름" validate={required()} />
      <TextInput source="description" label="설명" fullWidth />
      <TextInput source="collection" defaultValue="boardPosts" sx={{ display: "none" }} />
      <BooleanInput source="requiresLogin" label="로그인 필요" />
      <BooleanInput source="active" label="메뉴에 표시" defaultValue={true} />
      <NumberInput source="order" label="메뉴 순서" min={0} defaultValue={10} />
    </SimpleForm>
  );
}
function BoardEdit() {
  return (
    <Edit>
      <BoardForm />
    </Edit>
  );
}
function BoardCreate() {
  return (
    <Create>
      <BoardForm />
    </Create>
  );
}
function BoardPostList() {
  return (
    <List filters={searchFilters} sort={{ field: "createdAt", order: "DESC" }}>
      <Datagrid rowClick="edit">
        <TextField source="boardKey" label="게시판 키" />
        <TextField source="category" label="분류" />
        <TextField source="title" label="제목" />
        <DateField source="createdAt" label="작성일" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}
function BoardPostForm() {
  return <PostForm withBoard />;
}
function BoardPostEdit() {
  return (
    <Edit>
      <BoardPostForm />
    </Edit>
  );
}
function BoardPostCreate() {
  return (
    <Create>
      <BoardPostForm />
    </Create>
  );
}

export default function AdminApp() {
  return (
    <HashRouter>
      <Admin
        title="K-ON! 관리자"
        theme={adminTheme}
        dashboard={AdminDashboard}
        dataProvider={firebaseDataProvider}
        authProvider={firebaseAuthProvider}
        requireAuth
        disableTelemetry
      >
        <Resource
          name="notices"
          options={{ label: "공지" }}
          icon={Megaphone}
          list={PostList}
          edit={NoticeEdit}
          create={NoticeCreate}
        />
        <Resource
          name="news"
          options={{ label: "소식" }}
          icon={Newspaper}
          list={PostList}
          edit={NewsEdit}
          create={NewsCreate}
        />
        <Resource
          name="events"
          options={{ label: "행사·신청폼" }}
          icon={CalendarDays}
          list={EventList}
          edit={EventEdit}
          create={EventCreate}
        />
        <Resource name="sitePopups" options={{label:"사이트 팝업"}} icon={Megaphone} list={PopupList} edit={PopupEdit} create={PopupCreate}/>
        <Resource name="featurePages" options={{label:"이벤트 페이지"}} icon={CalendarDays} list={FeaturePageList} edit={FeaturePageEdit} create={FeaturePageCreate}/>
        <Resource name="movieWatchTopics" options={{label:"영화·이벤트 알림"}} icon={Film} list={MovieWatchList} edit={MovieWatchEdit} create={MovieWatchCreate}/>
        <Resource name="benefitDepletionReports" options={{label:"특전 소진 제보"}} icon={Ticket} list={BenefitReportList} edit={BenefitReportEdit}/>
        <Resource name="benefitReceiptConfirmations" options={{label:"특전 수령 인증"}} icon={Ticket} list={BenefitReceiptList} edit={BenefitReceiptEdit}/>
        <Resource
          name="inquiries"
          options={{ label: "문의" }}
          icon={HelpCircle}
          list={InquiryList}
          edit={InquiryEdit}
        />
        <Resource
          name="inquiryCategories"
          options={{ label: "문의 카테고리" }}
          icon={ListFilter}
          list={InquiryCategoryList}
          edit={InquiryCategoryEdit}
          create={InquiryCategoryCreate}
        />
        <Resource
          name="boardDefinitions"
          options={{ label: "게시판 관리" }}
          icon={Newspaper}
          list={BoardList}
          edit={BoardEdit}
          create={BoardCreate}
        />
        <Resource
          name="boardPosts"
          options={{ label: "게시판 글 관리" }}
          icon={Newspaper}
          list={BoardPostList}
          edit={BoardPostEdit}
          create={BoardPostCreate}
        />
        <Resource
          name="shops"
          options={{ label: "상점 관리" }}
          icon={Store}
          list={ShopList}
          edit={ShopEdit}
          create={ShopCreate}
        />
        <Resource
          name="products"
          options={{ label: "상점 상품" }}
          icon={Ticket}
          list={ProductList}
          edit={ProductEdit}
          create={ProductCreate}
        />
        <Resource name="orders" options={{ label: "상점 주문·환불" }} icon={ClipboardList} list={OrderList} edit={OrderEdit} />
        <Resource name="shopSettings" options={{ label: "상점 입금 계좌" }} icon={Ticket} list={ShopSettingsList} edit={ShopSettingsEdit} create={ShopSettingsCreate} />
        <Resource
          name="reservations"
          options={{ label: "예약" }}
          icon={ClipboardList}
          list={ReservationList}
          edit={ReservationEdit}
        />
        <Resource name="accountMessages" options={{label:"회원 쪽지"}} icon={Mail} list={AccountMessageList} edit={AccountMessageEdit} create={AccountMessageCreate}/>
        <Resource name="adminNotices" options={{label:"관리자 공지"}} icon={Bell} list={AdminNoticeList} edit={AdminNoticeEdit} create={AdminNoticeCreate}/>
        <Resource name="users" options={{label:"회원"}} icon={CircleUserRound} list={MemberList}/>
        <Resource name="pointHistory" options={{label:"포인트 내역"}} icon={Ticket} list={PointHistoryList}/>
        <Resource name="pointSettings" options={{label:"포인트 자동 지급"}} icon={Ticket} list={PointAutomationSettings}/>
        <Resource name="seatLayouts" options={{label:"좌석 배치 템플릿"}} icon={Armchair} list={SeatLayoutList} edit={SeatLayoutEdit} create={SeatLayoutCreate}/>
        <Resource
          name="ads"
          options={{ label: "수동 광고" }}
          icon={Ticket}
          list={AdList}
          edit={AdEdit}
          create={AdCreate}
        />
        <Resource
          name="siteSettings"
          options={{ label: "사이트 디자인" }}
          icon={ShieldCheck}
          list={SiteSettingsList}
        />
        <Resource name="imageHosting" options={{label:"이미지 호스팅 API"}} icon={ImagePlus} list={ImageHostingSettings}/>
        <Resource
          name="adminDirectory"
          options={{ label: "관리자 권한" }}
          icon={ShieldCheck}
          list={AdminList}
        />
      </Admin>
    </HashRouter>
  );
}
