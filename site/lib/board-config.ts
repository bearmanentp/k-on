import { HelpCircle, Megaphone, Newspaper, type LucideIcon } from "lucide-react";

export type BoardKey = "news" | "notices" | "inquiries";

export type BoardDefinition = {
  key: BoardKey;
  label: string;
  menuLabel: string;
  description: string;
  icon: LucideIcon;
  collection: string;
  requiresLogin?: boolean;
};

/** Add future public boards here. Header menus and the board page share this source. */
export const BOARD_DEFINITIONS: BoardDefinition[] = [
  { key: "news", label: "소식", menuLabel: "소식 게시판", description: "팬덤의 새로운 소식과 활동 이야기를 전합니다.", icon: Newspaper, collection: "news" },
  { key: "notices", label: "공지", menuLabel: "공지 게시판", description: "커뮤니티 이용과 행사에 관한 중요 안내입니다.", icon: Megaphone, collection: "notices" },
  { key: "inquiries", label: "문의", menuLabel: "문의 게시판", description: "로그인한 회원이 문의를 남기고 답변을 확인합니다.", icon: HelpCircle, collection: "inquiries", requiresLogin: true },
];

export const BOARD_BY_KEY = Object.fromEntries(BOARD_DEFINITIONS.map(board => [board.key, board])) as Record<BoardKey, BoardDefinition>;
