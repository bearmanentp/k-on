export const DEFAULT_K_ON_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/1/17/K-ON_anime_wordmark.svg";

const TBS_CHARACTER_BASE = "https://www.tbs.co.jp/anime/k-on/k-on_tv/chara";

export const DEFAULT_CHARACTER_IMAGES = [
  { name: "히라사와 유이", url: `${TBS_CHARACTER_BASE}/images/chara_photo01_1.gif`, source: `${TBS_CHARACTER_BASE}/chara01.html` },
  { name: "아키야마 미오", url: `${TBS_CHARACTER_BASE}/images/chara_photo02_1.gif`, source: `${TBS_CHARACTER_BASE}/chara02.html` },
  { name: "타이나카 리츠", url: `${TBS_CHARACTER_BASE}/images/chara_photo03_1.gif`, source: `${TBS_CHARACTER_BASE}/chara03.html` },
  { name: "코토부키 츠무기", url: `${TBS_CHARACTER_BASE}/images/chara_photo04_1.gif`, source: `${TBS_CHARACTER_BASE}/chara04.html` },
  { name: "나카노 아즈사", url: `${TBS_CHARACTER_BASE}/images/chara_photo08_1.gif`, source: `${TBS_CHARACTER_BASE}/chara08.html` },
];

export const DEFAULT_CHARACTER_IMAGE_LINES = DEFAULT_CHARACTER_IMAGES
  .map(({ name, url, source }) => `${name} | ${url} | ${source}`)
  .join("\n");
