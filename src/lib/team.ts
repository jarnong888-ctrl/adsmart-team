export type Pillar = "mindset" | "practical" | "trends";
export type Language = "zh" | "en" | "ms";

export type StrategyInput = {
  businessName: string;
  industry: string;
  audience: string;
  offers: string;
  tone: string;
  language: Language;
  capacity: number;
  mixMindset: number;
  mixPractical: number;
  mixTrends: number;
  softSellRatio: number;
  weekStart: string;
};

export type CalendarItemDraft = {
  dayIndex: number;
  slot: number;
  pillar: Pillar;
  title: string;
  angle: string;
  hook: string;
  cta: string;
  commentKeyword: string;
  softSell: boolean;
  language: Language;
};

export type WeekDraft = {
  title: string;
  rationale: string;
  items: CalendarItemDraft[];
};

const KEYWORDS = ["流程", "清单", "例子", "模板", "步骤", "开始", "报价", "客服", "表格", "一天", "收口", "三步"];

export function allocateMix(
  count: number,
  mix: { mindset: number; practical: number; trends: number },
): Pillar[] {
  const total = mix.mindset + mix.practical + mix.trends;
  if (total !== 100) throw new Error("Content mix must sum to 100.");
  if (count < 1) throw new Error("Posting capacity must be at least 1.");
  const keys: Pillar[] = ["mindset", "practical", "trends"];
  const raw = keys.map((key) => (count * mix[key]) / 100);
  const floors = raw.map((value) => Math.floor(value));
  let leftover = count - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - floors[index] }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (let step = 0; leftover > 0; step += 1) {
    floors[order[step % order.length].index] += 1;
    leftover -= 1;
  }
  const grouped: Pillar[] = [];
  keys.forEach((key, index) => {
    for (let n = 0; n < floors[index]; n += 1) grouped.push(key);
  });
  return interleave(grouped);
}

function interleave(pillars: Pillar[]): Pillar[] {
  const buckets: Record<Pillar, Pillar[]> = { mindset: [], practical: [], trends: [] };
  pillars.forEach((pillar) => buckets[pillar].push(pillar));
  const order: Pillar[] = ["practical", "mindset", "trends"];
  const result: Pillar[] = [];
  while (result.length < pillars.length) {
    for (const key of order) {
      const next = buckets[key].shift();
      if (next) result.push(next);
    }
  }
  return result;
}

export function markSoftSell(pillars: Pillar[], ratio: number): boolean[] {
  const count = Math.round((pillars.length * ratio) / 100);
  const ranked = pillars
    .map((pillar, index) => ({
      index,
      score: pillar === "practical" ? 0 : pillar === "trends" ? 1 : 2,
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index);
  const flags = pillars.map(() => false);
  for (let index = 0; index < count; index += 1) flags[ranked[index].index] = true;
  return flags;
}

export function offerLine(offers: string) {
  const line = offers
    .split(/\n|。|\.(?=\s)|；|;/)
    .map((part) => part.trim())
    .find(Boolean);
  return (line || offers).slice(0, 90);
}

function hookBank(language: Language, pillar: Pillar, index: number) {
  const banks: Record<Language, Record<Pillar, string[]>> = {
    zh: {
      mindset: ["先别买新工具", "你缺的不是软件", "这周只改一个动作", "等准备好，就会太晚", "老板最贵的是重复"],
      practical: ["给 AI 之前，先给这三样", "把一个流程缩到一张纸", "屏幕录下来，比口播有用", "报价之前先遮住这些", "客服不用从零打字"],
      trends: ["这周先别跟风", "有个说法还不能当事实", "先看你自己的数字", "热门功能先放一周", "别人的案例不是你的结果"],
    },
    en: {
      mindset: ["Don't buy another tool yet", "You are not short of software", "Change one action this week", "Waiting to feel ready is the delay", "Repetition is the expensive part"],
      practical: ["Give the model these three things first", "Shrink one process onto one page", "A screen recording beats a speech", "Cover this before you paste a quote", "Stop typing the same reply"],
      trends: ["Don't chase this week's fad", "A claim is not a fact yet", "Look at your own numbers first", "Park the hot feature for a week", "Their result is not your result"],
    },
    ms: {
      mindset: ["Jangan beli alat baharu dulu", "Anda tidak kekurangan perisian", "Tukar satu tindakan minggu ini", "Menunggu siap hanya melambatkan", "Kerja berulang itu yang mahal"],
      practical: ["Beri model tiga benda ini dulu", "Kecilkan satu proses ke satu muka", "Rakaman skrin lebih berguna", "Tutup ini sebelum tampal sebut harga", "Jangan taip jawapan yang sama"],
      trends: ["Jangan ikut gaya minggu ini", "Dakwaan belum tentu fakta", "Tengok nombor sendiri dulu", "Letak fungsi popular seminggu", "Hasil orang lain bukan hasil anda"],
    },
  };
  const list = banks[language][pillar];
  return list[index % list.length];
}

function titleFor(input: StrategyInput, pillar: Pillar, hook: string) {
  if (input.language === "zh") {
    if (pillar === "practical") return `${hook}，今天就能做`;
    if (pillar === "trends") return `${hook}，先别当事实`;
    return hook;
  }
  if (input.language === "ms") return `${hook} — ${input.businessName}`;
  return `${hook} — ${input.businessName}`;
}

function angleFor(input: StrategyInput, pillar: Pillar) {
  const offer = offerLine(input.offers);
  if (input.language === "zh") {
    if (pillar === "practical") return `给${input.audience}一个可以今天照做的做法。语气：${input.tone}。`;
    if (pillar === "trends") return `只讲和${input.industry}有关的变化，数字用【待核实】占位，拍之前补来源。`;
    return `${input.audience}容易把时间耗在重复上。${input.businessName}的立场：先固定流程，再谈工具。`;
  }
  if (input.language === "ms") {
    if (pillar === "practical") return `Tunjuk satu cara yang ${input.audience} boleh buat hari ini. Nada: ${input.tone}.`;
    if (pillar === "trends") return `Hanya perubahan yang berkaitan dengan ${input.industry}. Nombor ditanda [semak fakta].`;
    return `${input.audience} sering habiskan masa pada kerja berulang. Posisi ${input.businessName}: tetapkan proses dulu.`;
  }
  if (pillar === "practical") return `Show ${input.audience} one thing they can do today. Tone: ${input.tone}. Offer nearby: ${offer}.`;
  if (pillar === "trends") return `Only a change that touches ${input.industry}. Mark numbers as [fact-check] until a source is attached.`;
  return `${input.audience} lose hours to repetition. ${input.businessName} says: fix one process before buying another tool.`;
}

function ctaFor(input: StrategyInput, softSell: boolean, keyword: string) {
  const offer = offerLine(input.offers);
  if (input.language === "zh") {
    return softSell
      ? `如果想让我们带你做一遍：${offer}。评论「${keyword}」。`
      : `评论「${keyword}」，我把这张清单发给你。`;
  }
  if (input.language === "ms") {
    return softSell
      ? `Kalau mahu kami tunjuk sekali: ${offer}. Taip "${keyword}".`
      : `Taip "${keyword}" dan saya hantar senarai ini.`;
  }
  return softSell
    ? `If you want this done with you: ${offer}. Comment "${keyword}".`
    : `Comment "${keyword}" and I'll send the checklist.`;
}

export function buildWeek(input: StrategyInput): WeekDraft {
  const capacity = Math.max(1, Math.min(21, Math.round(input.capacity)));
  const pillars = allocateMix(capacity, {
    mindset: input.mixMindset,
    practical: input.mixPractical,
    trends: input.mixTrends,
  });
  const soft = markSoftSell(pillars, input.softSellRatio);
  const items: CalendarItemDraft[] = pillars.map((pillar, index) => {
    const hook = hookBank(input.language, pillar, index);
    const keyword = soft[index] ? (input.language === "zh" ? "想要" : "YES") : KEYWORDS[index % KEYWORDS.length];
    return {
      dayIndex: index % 7,
      slot: Math.floor(index / 7),
      pillar,
      title: titleFor(input, pillar, hook),
      angle: angleFor(input, pillar),
      hook,
      cta: ctaFor(input, soft[index], keyword),
      commentKeyword: keyword,
      softSell: soft[index],
      language: input.language,
    };
  });
  const softCount = soft.filter(Boolean).length;
  const title =
    input.language === "zh"
      ? `${input.weekStart} 这一周 · ${input.businessName}`
      : input.language === "ms"
        ? `Minggu ${input.weekStart} · ${input.businessName}`
        : `Week of ${input.weekStart} · ${input.businessName}`;
  const rationale =
    input.language === "zh"
      ? `${capacity} 条，配比 ${input.mixMindset}% 心态 / ${input.mixPractical}% 实操 / ${input.mixTrends}% 趋势，其中 ${softCount} 条软性销售。先批准整周，再写脚本。`
      : input.language === "ms"
        ? `${capacity} video. Campuran ${input.mixMindset}/${input.mixPractical}/${input.mixTrends}. ${softCount} daripadanya jualan lembut. Luluskan minggu ini sebelum skrip.`
        : `${capacity} videos. Mix ${input.mixMindset}% mindset / ${input.mixPractical}% practical / ${input.mixTrends}% trends. ${softCount} are soft sells. Approve the week before any script is written.`;
  return { title, rationale, items };
}

export type ContentFlag = "DEMO" | "NEEDS_FACT_CHECK" | "COMMERCIAL_DISCLOSURE";

export function flagsFor(item: { pillar: string; softSell: boolean }): ContentFlag[] {
  const flags: ContentFlag[] = [];
  if (item.pillar === "practical") flags.push("DEMO");
  if (item.pillar === "trends") flags.push("NEEDS_FACT_CHECK");
  if (item.softSell) flags.push("COMMERCIAL_DISCLOSURE");
  return flags;
}

export type ScriptDraft = {
  language: Language;
  hook: string;
  body: string;
  commentKeyword: string;
  sources: string;
  flags: string;
  durationSec: number;
};

export function buildScript(
  item: CalendarItemDraft,
  input: Pick<StrategyInput, "businessName" | "audience" | "tone">,
): ScriptDraft {
  const flags = flagsFor(item);
  const lines = renderBlocks(item, input);
  if (flags.includes("NEEDS_FACT_CHECK")) {
    lines.push("", item.language === "zh" ? "【待核实】口播里不要加没有出处的数字。" : item.language === "ms" ? "[Semak fakta] Jangan sebut nombor tanpa sumber." : "[Fact-check] Do not speak a number that has no source.");
  }
  if (flags.includes("COMMERCIAL_DISCLOSURE")) {
    lines.push("", item.language === "zh" ? "【商业披露】画面需要出现“这是我们的服务”或同等说明。" : item.language === "ms" ? "[Pendedahan] Paparkan bahawa ini perkhidmatan anda." : "[Disclosure] Show on screen that this is your own offer.");
  }
  if (flags.includes("DEMO")) {
    lines.push("", item.language === "zh" ? "【DEMO】实拍屏幕或操作，不要只用口播。" : item.language === "ms" ? "[DEMO] Rakam skrin, jangan hanya bercakap." : "[DEMO] Record the screen. Do not only talk.");
  }
  const sources = flags.includes("NEEDS_FACT_CHECK")
    ? item.language === "zh"
      ? "趋势条需要一手来源。模拟模式不会编造引用。拍摄前把【待核实】换成带日期的出处。"
      : item.language === "ms"
        ? "Video trend perlukan sumber utama. Mod mock tidak mereka petikan. Ganti penanda sebelum merakam."
        : "Trend posts need a primary source. Mock mode does not invent a citation. Replace the placeholder before filming."
    : item.language === "zh"
      ? "这是教学提纲，不是已核实的成效承诺。"
      : item.language === "ms"
        ? "Ini rangka pengajaran, bukan janji hasil yang telah disahkan."
        : "This is a teaching outline, not a verified performance claim.";
  return {
    language: item.language,
    hook: item.hook,
    body: lines.join("\n"),
    commentKeyword: item.commentKeyword,
    sources,
    flags: flags.join(","),
    durationSec: 30,
  };
}

function renderBlocks(item: CalendarItemDraft, input: Pick<StrategyInput, "businessName" | "audience" | "tone">) {
  if (item.language === "zh") {
    return [
      "[00:00–00:03] 钩子",
      "画面：近景，对着镜头，背景是工作台",
      `字幕：${item.hook}`,
      `口播：${item.hook}。`,
      "",
      "[00:03–00:12] 问题",
      `画面：一个具体的混乱瞬间，和「${input.audience}」有关`,
      `字幕：先看卡在哪里`,
      `口播：${item.angle}`,
      "",
      "[00:12–00:24] 做法",
      "画面：三步，每步一个大字",
      "字幕：1 讲清楚  2 给例子  3 人来收尾",
      `口播：不要把整件事丢给工具。先讲背景，再给一个你满意的例子，最后${input.businessName}这种做法是人来收口。语气保持${input.tone}。`,
      "",
      "[00:24–00:30] 行动",
      "画面：看镜头，字幕留下评论关键词",
      `字幕：评论「${item.commentKeyword}」`,
      `口播：${item.cta}`,
    ];
  }
  if (item.language === "ms") {
    return [
      "[00:00–00:03] Cangkuk",
      "Visual: dekat, pandang kamera, meja kerja di belakang",
      `Sari kata: ${item.hook}`,
      `Tutur: ${item.hook}.`,
      "",
      "[00:03–00:12] Masalah",
      `Visual: satu saat kelam-kabut yang ${input.audience} kenali`,
      "Sari kata: Tengok di mana ia tersekat",
      `Tutur: ${item.angle}`,
      "",
      "[00:12–00:24] Cara",
      "Visual: tiga langkah, satu perkataan besar setiap satu",
      "Sari kata: 1 jelaskan  2 bagi contoh  3 manusia tutup",
      `Tutur: Jangan serahkan seluruh kerja kepada alat. Beri konteks, beri satu contoh yang anda suka, kemudian manusia yang menutup. Nada: ${input.tone}.`,
      "",
      "[00:24–00:30] Tindakan",
      "Visual: pandang kamera, kata kunci komen pada skrin",
      `Sari kata: Taip "${item.commentKeyword}"`,
      `Tutur: ${item.cta}`,
    ];
  }
  return [
    "[00:00–00:03] Hook",
    "Visual: close-up, to camera, workbench behind",
    `Subtitle: ${item.hook}`,
    `Spoken: ${item.hook}.`,
    "",
    "[00:03–00:12] Problem",
    `Visual: one messy moment ${input.audience} will recognise`,
    "Subtitle: Start where it sticks",
    `Spoken: ${item.angle}`,
    "",
    "[00:12–00:24] Move",
    "Visual: three steps, one big word each",
    "Subtitle: 1 context  2 example  3 a person closes it",
    `Spoken: Don't hand the whole job to the tool. Give context, give one example you actually like, then a person closes it. Keep the tone ${input.tone}.`,
    "",
    "[00:24–00:30] Ask",
    "Visual: to camera, comment keyword on screen",
    `Subtitle: Comment "${item.commentKeyword}"`,
    `Spoken: ${item.cta}`,
  ];
}

export type RepurposeDraft = {
  igCaption: string;
  carouselOutline: string;
  facebookPost: string;
  sizeNotes: string;
};

export function buildRepurpose(item: CalendarItemDraft, script: ScriptDraft): RepurposeDraft {
  const slides =
    item.language === "zh"
      ? [`1 封面：${item.hook}`, `2 问题：${item.angle}`, "3 第一步：先讲背景", "4 第二步：给一个好例子", "5 第三步：人来收尾", `6 行动：${item.cta}`]
      : item.language === "ms"
        ? [`1 Muka depan: ${item.hook}`, `2 Masalah: ${item.angle}`, "3 Langkah 1: beri konteks", "4 Langkah 2: satu contoh baik", "5 Langkah 3: manusia menutup", `6 Tindakan: ${item.cta}`]
        : [`1 Cover: ${item.hook}`, `2 Problem: ${item.angle}`, "3 Step 1: give context", "4 Step 2: one good example", "5 Step 3: a person closes it", `6 Ask: ${item.cta}`];
  const sizeNotes =
    item.language === "zh"
      ? "9:16 — TikTok、Reels、Stories。钩子字幕放在中间 80%。\n1:1 — Facebook 信息流方图。\n4:5 — Instagram 竖图。\n16:9 — 网站或长视频。从 9:16 母带裁切，不要重讲一遍。"
      : item.language === "ms"
        ? "9:16 — TikTok, Reels, Stories. Sari kata cangkuk di tengah 80%.\n1:1 — suapan Facebook.\n4:5 — potret Instagram.\n16:9 — laman atau video panjang. Potong dari induk 9:16."
        : "9:16 — TikTok, Reels, Stories. Keep the hook subtitle inside the centre 80%.\n1:1 — Facebook feed.\n4:5 — Instagram portrait.\n16:9 — site or long video. Crop the 9:16 master; do not restack the story.";
  const ig =
    item.language === "zh"
      ? `${item.hook}\n\n${item.angle}\n\n${item.cta}\n\n${script.flags ? `标记：${script.flags}` : ""}`.trim()
      : `${item.hook}\n\n${item.angle}\n\n${item.cta}\n\n${script.flags ? `Flags: ${script.flags}` : ""}`.trim();
  const facebook =
    item.language === "zh"
      ? `${item.title}\n\n${item.angle}\n\n做法就三步：讲清楚背景，给一个你满意的例子，最后自己收口。\n\n${item.cta}`
      : item.language === "ms"
        ? `${item.title}\n\n${item.angle}\n\nTiga langkah: konteks, satu contoh yang anda suka, kemudian manusia menutup.\n\n${item.cta}`
        : `${item.title}\n\n${item.angle}\n\nThree moves: context, one example you like, then a person closes it.\n\n${item.cta}`;
  return { igCaption: ig, carouselOutline: slides.join("\n"), facebookPost: facebook, sizeNotes };
}

export type BriefDraft = {
  cuts: string;
  captions: string;
  aspectRatios: string;
  musicNote: string;
};

export function buildBrief(item: CalendarItemDraft, script: ScriptDraft): BriefDraft {
  const cuts =
    item.language === "zh"
      ? "0.0s 钩子口播，不要片头动画。\n3.0s 切到问题画面，保留环境声。\n12.0s 三步各约 4 秒，大字后立刻演示。\n24.0s 回到口播，关键词停到 30.0s。\n不要加自动生成的片尾。\n" + (script.flags ? `保留标记：${script.flags}` : "")
      : item.language === "ms"
        ? "0.0s cangkuk, tanpa animasi pembuka.\n3.0s masalah, kekalkan bunyi bilik.\n12.0s tiga langkah, sekitar 4 saat setiap satu.\n24.0s kembali ke kamera sehingga 30.0s.\n" + (script.flags ? `Kekalkan tanda: ${script.flags}` : "")
        : "0.0s hook to camera. No title animation.\n3.0s the problem shot. Keep the room tone.\n12.0s three steps, about 4 seconds each, word then demo.\n24.0s back to camera. Hold the keyword through 30.0s.\nNo generated end card.\n" + (script.flags ? `Keep flags: ${script.flags}` : "");
  const captions =
    item.language === "zh"
      ? `主字幕：${item.hook}\n关键词字幕：${item.commentKeyword}\n安全区：避开右侧按钮和底部说明。每行不超过 14 个字。`
      : item.language === "ms"
        ? `Sari kata utama: ${item.hook}\nKata kunci: ${item.commentKeyword}\nElak butang kanan dan kapsyen bawah. Maksimum 8 perkataan sebaris.`
        : `Main caption: ${item.hook}\nKeyword caption: ${item.commentKeyword}\nStay clear of the right-side buttons and the bottom caption. Max 8 words a line.`;
  const aspectRatios = "9:16\n1:1\n4:5\n16:9";
  const musicNote =
    item.language === "zh"
      ? "人声优先。音乐只在问题画面垫低，钩子和行动段不要压过人声。用有授权的曲库。"
      : item.language === "ms"
        ? "Suara diutamakan. Muzik rendah hanya pada bahagian masalah. Guna muzik berlesen."
        : "Voice first. Music only under the problem shot, low. Use a track you have the rights to.";
  return { cuts, captions, aspectRatios, musicNote };
}

export function strategyFromWorkspace(workspace: {
  name: string;
  industry: string;
  audience: string;
  offers: string;
  tone: string;
  primaryLanguage: string;
  postingCapacity: number;
  mixMindset: number;
  mixPractical: number;
  mixTrends: number;
  softSellRatio: number;
}, weekStart: string, overrides?: Partial<StrategyInput>): StrategyInput {
  const language: Language =
    overrides?.language ||
    (workspace.primaryLanguage === "en" || workspace.primaryLanguage === "ms" ? workspace.primaryLanguage : "zh");
  return {
    businessName: workspace.name,
    industry: workspace.industry,
    audience: workspace.audience,
    offers: workspace.offers,
    tone: workspace.tone,
    language,
    capacity: overrides?.capacity ?? workspace.postingCapacity,
    mixMindset: overrides?.mixMindset ?? workspace.mixMindset,
    mixPractical: overrides?.mixPractical ?? workspace.mixPractical,
    mixTrends: overrides?.mixTrends ?? workspace.mixTrends,
    softSellRatio: overrides?.softSellRatio ?? workspace.softSellRatio,
    weekStart,
  };
}
