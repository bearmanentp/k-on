import Link from "next/link";

export default function PrivacyPage() {
  return <main className="policy-page"><div className="policy-card"><Link href="/">← K-ON! FANDOM KR</Link><p className="policy-eyebrow">PRIVACY</p><h1>개인정보 처리방침</h1><p>서비스 이용에 필요한 최소한의 정보만 Firebase에 저장합니다.</p><h2>수집 정보</h2><p>이메일 로그인 시 이메일 주소와 Firebase 인증 식별자를 저장합니다. 행사 신청·문의 작성 시 회원 식별자, 이메일, 입력한 답변과 작성 시간을 저장합니다.</p><h2>이용 목적</h2><p>로그인 확인, 행사 예약 처리, 문의 답변, 계정 알림과 관리자 운영을 위해 사용합니다.</p><h2>보관과 삭제</h2><p>회원은 운영자에게 계정 및 관련 데이터 삭제를 요청할 수 있습니다. Firebase 보안 규칙에 따라 본인 정보와 관리자 업무 범위가 분리됩니다.</p><h2>문의</h2><p>개인정보 관련 문의는 사이트 문의 게시판을 이용해 주세요.</p></div></main>;
}
