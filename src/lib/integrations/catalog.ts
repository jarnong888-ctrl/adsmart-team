export const CONNECTABLE = ["google", "tiktok", "instagram", "facebook", "youtube"] as const;
export type ProviderId = (typeof CONNECTABLE)[number];

export type CardCategory = "files" | "social" | "soon";

export type IntegrationCard = {
  id: string;
  provider: ProviderId | "linkedin" | "x";
  category: CardCategory;
  comingSoon: boolean;
  nameEn: string;
  nameZh: string;
  useEn: string;
  useZh: string;
  scopesEn: string;
  scopesZh: string;
};

export const INTEGRATION_CARDS: IntegrationCard[] = [
  {
    id: "google_drive",
    provider: "google",
    category: "files",
    comingSoon: false,
    nameEn: "Google Drive",
    nameZh: "Google Drive",
    useEn: "The team saves scripts, briefs, and exports into a folder you choose.",
    useZh: "团队把脚本、剪辑单和导出文件存进你选的文件夹。",
    scopesEn: "Create and edit only the files this app creates. See your email so we can name the connection.",
    scopesZh: "只能创建和修改本应用自己建的文件。读取邮箱，用来显示连的是哪个账号。",
  },
  {
    id: "google_sheets",
    provider: "google",
    category: "files",
    comingSoon: false,
    nameEn: "Google Sheets",
    nameZh: "Google Sheets",
    useEn: "Optional sheet for the content calendar and report export. Same Google sign-in as Drive.",
    useZh: "可选的表格，用来放内容日历和报告导出。和 Drive 是同一次 Google 登录。",
    scopesEn: "Read and edit the spreadsheets you pick. See your email so we can name the connection.",
    scopesZh: "读写你指定的表格。读取邮箱，用来显示连的是哪个账号。",
  },
  {
    id: "tiktok",
    provider: "tiktok",
    category: "social",
    comingSoon: false,
    nameEn: "TikTok",
    nameZh: "TikTok",
    useEn: "Analytics, and the account Adsmart’s scheduler posts to after you approve.",
    useZh: "用来看数据，也是你批准之后，Adsmart 的排程要发到的账号。",
    scopesEn: "Read account stats. Publish only videos you have already approved.",
    scopesZh: "读取账号数据。只发布你已经批准的视频。",
  },
  {
    id: "instagram",
    provider: "instagram",
    category: "social",
    comingSoon: false,
    nameEn: "Instagram",
    nameZh: "Instagram",
    useEn: "Analytics, and the profile Adsmart’s scheduler posts to after you approve.",
    useZh: "用来看数据，也是你批准之后，Adsmart 的排程要发到的账号。",
    scopesEn: "Read professional account insights. Publish only posts you have already approved.",
    scopesZh: "读取专业账号数据。只发布你已经批准的帖子。",
  },
  {
    id: "facebook",
    provider: "facebook",
    category: "social",
    comingSoon: false,
    nameEn: "Facebook Page",
    nameZh: "Facebook 主页",
    useEn: "Analytics for your Page, and the Page Adsmart’s scheduler posts to after you approve.",
    useZh: "用来看主页数据，也是你批准之后，Adsmart 的排程要发到的主页。",
    scopesEn: "Read Page insights. Publish only posts you have already approved.",
    scopesZh: "读取主页数据。只发布你已经批准的帖子。",
  },
  {
    id: "youtube",
    provider: "youtube",
    category: "social",
    comingSoon: false,
    nameEn: "YouTube",
    nameZh: "YouTube",
    useEn: "Channel stats for analytics. Uploads still wait until you approve.",
    useZh: "读取频道数据。上传仍然要等你批准。",
    scopesEn: "Read your channel. Upload videos only after you approve them.",
    scopesZh: "读取你的频道。只有在你批准之后才上传视频。",
  },
  {
    id: "linkedin",
    provider: "linkedin",
    category: "soon",
    comingSoon: true,
    nameEn: "LinkedIn",
    nameZh: "LinkedIn",
    useEn: "Coming soon.",
    useZh: "即将支持。",
    scopesEn: "Not requested yet.",
    scopesZh: "还不会申请权限。",
  },
  {
    id: "x",
    provider: "x",
    category: "soon",
    comingSoon: true,
    nameEn: "X",
    nameZh: "X",
    useEn: "Coming soon.",
    useZh: "即将支持。",
    scopesEn: "Not requested yet.",
    scopesZh: "还不会申请权限。",
  },
];

export const CATEGORIES: { id: CardCategory; en: string; zh: string }[] = [
  { id: "files", en: "Files and data", zh: "文件和数据" },
  { id: "social", en: "Your social accounts", zh: "你的社交账号" },
  { id: "soon", en: "Coming soon", zh: "即将支持" },
];

export function isProviderId(value: string): value is ProviderId {
  return (CONNECTABLE as readonly string[]).includes(value);
}

export function clientConnectsProvider(provider: string) {
  return provider !== "buffer" && provider !== "canva";
}
