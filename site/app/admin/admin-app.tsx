"use client";

import {
  Admin,
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
  List,
  NumberField,
  NumberInput,
  Resource,
  SelectInput,
  SimpleForm,
  TextField,
  TextInput,
  required,
} from "react-admin";
import {
  CalendarDays,
  ClipboardList,
  HelpCircle,
  ListFilter,
  Megaphone,
  Newspaper,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { HashRouter } from "react-router-dom";
import {
  firebaseAuthProvider,
  firebaseDataProvider,
} from "./firebase-provider";
import { RichTextInput } from "./rich-text-input";
import { AdminDashboard } from "./dashboard";

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
function PostForm() {
  return (
    <SimpleForm>
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
        <NumberField source="capacity" label="정원" />
        <TextField source="status" label="상태" />
        <EditButton />
      </Datagrid>
    </List>
  );
}
function EventEdit() {
  return (
    <Edit>
      <SimpleForm>
        <TextInput
          source="title"
          label="행사명"
          validate={required()}
          fullWidth
        />
        <DateTimeInput source="date" label="일시" validate={required()} />
        <TextInput source="place" label="장소" validate={required()} />
        <NumberInput source="capacity" label="정원" min={1} />
        <TextInput source="summary" label="소개" multiline rows={4} fullWidth />
        <SelectInput
          source="status"
          label="상태"
          choices={[
            { id: "open", name: "접수 중" },
            { id: "closed", name: "마감" },
          ]}
        />
      </SimpleForm>
    </Edit>
  );
}
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
        <TextInput
          source="answer"
          label="관리자 답변"
          multiline
          rows={7}
          fullWidth
        />
        <SelectInput
          source="status"
          label="상태"
          choices={[
            { id: "waiting", name: "답변 대기" },
            { id: "answered", name: "답변 완료" },
          ]}
        />
      </SimpleForm>
    </Edit>
  );
}
function InquiryCategoryList() {
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
        <TextField source="status" label="상태" />
        <DateField source="createdAt" label="신청일" />
        <EditButton />
      </Datagrid>
    </List>
  );
}
function ReservationEdit() {
  return (
    <Edit>
      <SimpleForm>
        <TextInput source="userEmail" label="회원" disabled fullWidth />
        <TextInput source="eventTitle" label="행사" disabled fullWidth />
        <SelectInput
          source="status"
          label="진행 상태"
          choices={[
            { id: "received", name: "접수" },
            { id: "reviewing", name: "검토 중" },
            { id: "confirmed", name: "확정" },
            { id: "completed", name: "안내 완료" },
          ]}
        />
      </SimpleForm>
    </Edit>
  );
}
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
    <SimpleForm>
      <BooleanInput source="active" label="광고 노출" />
      <SelectInput
        source="slot"
        label="노출 위치"
        choices={[
          { id: "after-hub", name: "둘러보기 다음" },
          { id: "after-community", name: "커뮤니티 다음" },
        ]}
      />
      <TextInput source="label" label="작은 라벨" defaultValue="PARTNER" />
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
        label="이미지 URL (권장)"
        helperText="Firebase Storage 대신 외부 이미지 링크 사용을 권장합니다."
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
        <TextField source="name" label="상품명" />
        <NumberField source="price" label="가격" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
}
function ProductForm() {
  return (
    <SimpleForm>
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
      <TextInput source="imageUrl" label="이미지 URL" fullWidth />
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
  return <Edit><SimpleForm><TextInput source="userEmail" label="구매자" disabled fullWidth /><TextInput source="productName" label="상품" disabled fullWidth /><NumberInput source="amount" label="금액" disabled /><TextInput source="depositorName" label="입금자명" disabled /><SelectInput source="status" label="처리 상태" choices={[{ id: "awaiting_transfer", name: "입금 대기" }, { id: "payment_reported", name: "입금 확인 중" }, { id: "payment_confirmed", name: "결제 승인" }, { id: "payment_rejected_refund_pending", name: "입금 거절 · 환불 예정" }, { id: "refund_requested", name: "환불 신청 검토 중" }, { id: "refund_rejected", name: "환불 신청 거절" }, { id: "refund_approved", name: "환불 진행 중" }, { id: "refunded", name: "환불 완료" }, { id: "canceled", name: "주문 취소" }]} /><TextInput source="buyerRefundReason" label="구매자 환불 신청 사유" disabled multiline rows={3} fullWidth /><TextInput source="adminRefundReason" label="관리자 처리/거절 사유" multiline rows={4} fullWidth helperText="입금 거절 또는 구매자 환불 신청 거절 시 반드시 사유를 작성하세요." /></SimpleForm></Edit>;
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
function SiteSettingsList() {
  return (
    <List pagination={false} sort={{ field: "updatedAt", order: "DESC" }}>
      <Datagrid rowClick="edit">
        <TextField source="siteName" label="사이트 이름" />
        <TextField source="fontFamily" label="전체 글꼴" />
        <TextField source="accentColor" label="강조 색상" />
        <DateField source="updatedAt" label="마지막 변경" showTime />
        <EditButton />
      </Datagrid>
    </List>
  );
}
function SiteSettingsEdit() {
  return (
    <Edit>
      <SimpleForm>
        <TextInput source="siteName" label="사이트 이름" fullWidth />
        <TextInput
          source="logoUrl"
          label="로고 이미지 URL"
          fullWidth
          helperText="외부 이미지 또는 Google Drive 공유 링크를 권장합니다."
        />
        <TextInput
          source="fontFamily"
          label="전체 글꼴"
          fullWidth
          helperText={'예: "Pretendard", "Noto Sans KR", sans-serif'}
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
    </Edit>
  );
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
    <SimpleForm>
      <TextInput
        source="key"
        label="주소 키"
        validate={required()}
        helperText="영문 소문자와 하이픈만 권장"
      />
      <TextInput source="label" label="게시판 이름" validate={required()} />
      <TextInput source="menuLabel" label="메뉴 이름" validate={required()} />
      <TextInput source="description" label="설명" fullWidth />
      <TextInput
        source="collection"
        label="Firestore 컬렉션"
        validate={required()}
      />
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
  return (
    <SimpleForm>
      <TextInput
        source="boardKey"
        label="게시판 키"
        validate={required()}
        helperText="게시판 관리에서 만든 주소 키"
      />
      <TextInput source="category" label="분류" validate={required()} />
      <TextInput source="title" label="제목" validate={required()} fullWidth />
      <BooleanInput source="pinned" label="필독 고정" />
      <RichTextInput />
    </SimpleForm>
  );
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
        />
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
          options={{ label: "추가 게시판 글" }}
          icon={Newspaper}
          list={BoardPostList}
          edit={BoardPostEdit}
          create={BoardPostCreate}
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
          edit={SiteSettingsEdit}
        />
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
