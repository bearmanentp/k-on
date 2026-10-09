"use client";

import {
  Admin, BooleanField, BooleanInput, Create, Datagrid, DateField, DateTimeInput,
  DeleteButton, Edit, EditButton, EmailField, List, NumberField, NumberInput,
  Resource, SelectInput, SimpleForm, TextField, TextInput, required,
} from "react-admin";
import { CalendarDays, ClipboardList, HelpCircle, Megaphone, Newspaper, ShieldCheck, Ticket } from "lucide-react";
import { HashRouter } from "react-router-dom";
import { firebaseAuthProvider, firebaseDataProvider } from "./firebase-provider";
import { RichTextInput } from "./rich-text-input";
import { AdminDashboard } from "./dashboard";

const searchFilters=[<TextInput key="q" source="q" label="검색" alwaysOn/>];

function PostList(){return <List filters={searchFilters} sort={{field:"createdAt",order:"DESC"}}><Datagrid rowClick="edit"><BooleanField source="pinned" label="필독"/><TextField source="category" label="분류"/><TextField source="title" label="제목"/><DateField source="createdAt" label="작성일"/><EditButton/><DeleteButton/></Datagrid></List>;}
function PostForm(){return <SimpleForm><TextInput source="category" label="분류" validate={required()} fullWidth/><TextInput source="title" label="제목" validate={required()} fullWidth/><BooleanInput source="pinned" label="필독 고정"/><RichTextInput/></SimpleForm>;}
function NoticeEdit(){return <Edit><PostForm/></Edit>;}
function NoticeCreate(){return <Create><PostForm/></Create>;}
function NewsEdit(){return <Edit><PostForm/></Edit>;}
function NewsCreate(){return <Create><PostForm/></Create>;}
function EventList(){return <List sort={{field:"date",order:"DESC"}}><Datagrid rowClick="edit"><TextField source="title" label="행사명"/><DateField source="date" label="일시" showTime/><TextField source="place" label="장소"/><NumberField source="capacity" label="정원"/><TextField source="status" label="상태"/><EditButton/></Datagrid></List>;}
function EventEdit(){return <Edit><SimpleForm><TextInput source="title" label="행사명" validate={required()} fullWidth/><DateTimeInput source="date" label="일시" validate={required()}/><TextInput source="place" label="장소" validate={required()}/><NumberInput source="capacity" label="정원" min={1}/><TextInput source="summary" label="소개" multiline rows={4} fullWidth/><SelectInput source="status" label="상태" choices={[{id:"open",name:"접수 중"},{id:"closed",name:"마감"}]}/></SimpleForm></Edit>;}
function InquiryList(){return <List filters={searchFilters} sort={{field:"createdAt",order:"DESC"}}><Datagrid rowClick="edit"><EmailField source="userEmail" label="회원"/><TextField source="category" label="분류"/><TextField source="title" label="제목"/><TextField source="status" label="상태"/><DateField source="createdAt" label="작성일"/><EditButton/></Datagrid></List>;}
function InquiryEdit(){return <Edit><SimpleForm><TextInput source="userEmail" label="회원" disabled fullWidth/><TextInput source="title" label="제목" disabled fullWidth/><TextInput source="body" label="문의 내용" disabled multiline rows={7} fullWidth/><TextInput source="answer" label="관리자 답변" multiline rows={7} fullWidth/><SelectInput source="status" label="상태" choices={[{id:"waiting",name:"답변 대기"},{id:"answered",name:"답변 완료"}]}/></SimpleForm></Edit>;}
function ReservationList(){return <List filters={searchFilters} sort={{field:"createdAt",order:"DESC"}}><Datagrid rowClick="edit"><EmailField source="userEmail" label="회원"/><TextField source="eventTitle" label="행사"/><TextField source="status" label="상태"/><DateField source="createdAt" label="신청일"/><EditButton/></Datagrid></List>;}
function ReservationEdit(){return <Edit><SimpleForm><TextInput source="userEmail" label="회원" disabled fullWidth/><TextInput source="eventTitle" label="행사" disabled fullWidth/><SelectInput source="status" label="진행 상태" choices={[{id:"received",name:"접수"},{id:"reviewing",name:"검토 중"},{id:"confirmed",name:"확정"},{id:"completed",name:"안내 완료"}]}/></SimpleForm></Edit>;}
function AdminList(){return <List sort={{field:"updatedAt",order:"DESC"}}><Datagrid><EmailField source="email" label="관리자"/><TextField source="permissions" label="권한"/><BooleanField source="active" label="활성"/><DateField source="updatedAt" label="변경일" showTime/></Datagrid></List>;}
function AdList(){return <List sort={{field:"createdAt",order:"DESC"}}><Datagrid rowClick="edit"><BooleanField source="active" label="노출"/><TextField source="slot" label="위치"/><TextField source="label" label="라벨"/><TextField source="title" label="제목"/><EditButton/><DeleteButton/></Datagrid></List>;}
function AdForm(){return <SimpleForm><BooleanInput source="active" label="광고 노출"/><SelectInput source="slot" label="노출 위치" choices={[{id:"after-hub",name:"둘러보기 다음"},{id:"after-community",name:"커뮤니티 다음"}]}/><TextInput source="label" label="작은 라벨" defaultValue="PARTNER"/><TextInput source="title" label="광고 제목" validate={required()} fullWidth/><TextInput source="body" label="광고 설명" multiline rows={3} fullWidth/><TextInput source="href" label="연결 주소" helperText="외부 링크 또는 /events 같은 내부 경로" fullWidth/><TextInput source="imageUrl" label="이미지 URL (권장)" helperText="Firebase Storage 대신 외부 이미지 링크 사용을 권장합니다." fullWidth/></SimpleForm>;}
function AdEdit(){return <Edit><AdForm/></Edit>;}
function AdCreate(){return <Create><AdForm/></Create>;}

export default function AdminApp(){return <HashRouter><Admin title="K-ON! 관리자" dashboard={AdminDashboard} dataProvider={firebaseDataProvider} authProvider={firebaseAuthProvider} requireAuth disableTelemetry><Resource name="notices" options={{label:"공지"}} icon={Megaphone} list={PostList} edit={NoticeEdit} create={NoticeCreate}/><Resource name="news" options={{label:"소식"}} icon={Newspaper} list={PostList} edit={NewsEdit} create={NewsCreate}/><Resource name="events" options={{label:"행사·신청폼"}} icon={CalendarDays} list={EventList} edit={EventEdit}/><Resource name="inquiries" options={{label:"문의"}} icon={HelpCircle} list={InquiryList} edit={InquiryEdit}/><Resource name="reservations" options={{label:"예약"}} icon={ClipboardList} list={ReservationList} edit={ReservationEdit}/><Resource name="ads" options={{label:"수동 광고"}} icon={Ticket} list={AdList} edit={AdEdit} create={AdCreate}/><Resource name="adminDirectory" options={{label:"관리자 권한"}} icon={ShieldCheck} list={AdminList}/></Admin></HashRouter>;}
