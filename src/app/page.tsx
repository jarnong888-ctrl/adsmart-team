import Link from "next/link";
import { LocaleSwitch } from "@/components/locale-switch";
import { tr } from "@/lib/i18n";
import { login } from "@/server/auth-actions";
import { getLocale } from "@/server/guard";

const steps = [
  ["01", "计划 Plan", "一周内容，配好心态、实操、趋势和软性销售。先批整周，再开工。", "A week with mindset, practical, trends, and soft sell. Approve the week, then start."],
  ["02", "批准 Approve", "人来点头，不是模型。手机上也能审，按钮够大，看得清在批什么。", "A person says yes, not the model. Large enough to approve on a phone."],
  ["03", "制作 Make", "编剧、改写、剪辑单一条流水线做完。数字对不上出处，就会停下来等核实。", "Script, repurpose, edit brief. If a number has no source, it stops for a fact-check."],
  ["04", "排队 Queue", "排进 TikTok 和 Instagram。队列不会自己发出去。你没点发布，它就停在那里。", "Queued for TikTok and Instagram. The queue does not post itself."],
] as const;

const desks = [
  ["策", "内容策略", "Content strategist", "一周内容，配比和行动号召，控制软性销售的比例。", "The week, the mix, and the soft-sell ratio."],
  ["编", "编剧", "Scriptwriter", "30 秒口播，三种语言。画面、字幕、口播分开写。", "30 seconds, three languages. Visual, subtitle, and spoken lines stay separate."],
  ["改", "改写", "Repurposer", "一条脚本改成 caption、轮播、Facebook 和其他尺寸。", "One script becomes a caption, a carousel, and a Facebook post."],
  ["剪", "剪辑", "Video editor", "剪辑单：镜头、比例、字幕。成片文件还是你的。", "The brief: cuts, ratios, captions. The file stays yours."],
  ["社", "社媒", "Social", "一条不会自己发布的队列。批准之前，发布是关着的。", "A queue that cannot post itself. Publish stays off until you approve."],
  ["数", "数据", "Analytics", "今天和粉丝目标之间的距离，用你自己的数字说话。", "The distance between today and the follower goal, in your numbers."],
  ["析", "分析", "Marketing analyst", "速度对不上目标时，先问方向，不先堆更多脚本。", "When pace misses the goal, question the direction before adding scripts."],
  ["总", "CMO", "CMO", "看整盘在卖什么，决定下一周值不值得继续加码。", "Reads the whole offer and decides whether next week should push harder."],
] as const;

export default async function HomePage() {
  const locale = await getLocale();
  const zh = locale === "zh";
  return (
    <div className="min-h-screen bg-[#F6F7F5] text-[#14201B]">
      <header className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded-[4px] bg-[#0F6B4F] text-[13px] font-semibold text-white">A</span>
          <span className="text-[14px] font-semibold">Adsmart Team</span>
          <span className="hidden text-[13px] tracking-wide text-[#5E6B65] sm:inline">KUALA LUMPUR</span>
        </div>
        <nav className="flex items-center gap-2 text-[13px]">
          <LocaleSwitch locale={locale} />
          <Link href="/pricing" className="hidden h-8 items-center px-2 sm:inline-flex">{tr(locale, "Credits", "点数")}</Link>
          <Link href="/login" className="hidden h-8 items-center px-2 sm:inline-flex">{tr(locale, "Log in", "登录")}</Link>
          <form action={login}>
            <input type="hidden" name="email" value="demo@adsmart.my" />
            <input type="hidden" name="password" value="studio-demo" />
            <input type="hidden" name="next" value="/studio" />
            <button type="submit" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#0F6B4F] bg-[#0F6B4F] px-4 text-[14px] font-semibold text-white shadow-[0_1px_0_rgba(8,107,84,0.9),0_1px_2px_rgba(12,46,40,0.18)] hover:bg-[#0A5540]">{tr(locale, "Open the Jarno demo", "打开 Jarno 演示")}</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1120px] px-4 pb-16">
        <p className="mt-10 text-[13px] text-[#5E6B65]">{zh ? "ADSMART · 吉隆坡" : "ADSMART · KUALA LUMPUR"}</p>
        <h1 className="mt-3 max-w-[18ch] text-[40px] leading-[1.2] font-semibold max-sm:text-[28px]">
          {zh ? "一支会等你点头的 AI 营销团队。" : "An AI marketing team that waits for your yes."}
        </h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-[1.5] text-[#3F4C46]">
          {zh ? "An AI marketing team that waits for your yes." : "一支会等你点头的 AI 营销团队。"}
        </p>
        <p className="mt-3 max-w-2xl text-[14px] leading-[1.65] text-[#3F4C46]">
          {zh
            ? "卖给马来西亚中小企业。和 Jarno Ng 给 @jarnong 用的是同一套岗位：先计划一周，再写脚本，没有人批准，什么都不会发出去。"
            : "Sold to Malaysian SMEs. The same desks Jarno Ng uses for @jarnong: plan the week, write the scripts, and nothing goes out until a person approves it."}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <form action={login}>
            <input type="hidden" name="email" value="demo@adsmart.my" />
            <input type="hidden" name="password" value="studio-demo" />
            <input type="hidden" name="next" value="/studio" />
            <button type="submit" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#0F6B4F] bg-[#0F6B4F] px-4 text-[14px] font-semibold text-white shadow-[0_1px_0_rgba(8,107,84,0.9),0_1px_2px_rgba(12,46,40,0.18)] hover:bg-[#0A5540]">{tr(locale, "Open the Jarno demo", "打开 Jarno 演示")}</button>
          </form>
          <Link href="/signup" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#DCE1DE] bg-[#E9F4EE] px-4 text-[14px] font-semibold text-[#0F6B4F]">{tr(locale, "Start a workspace", "创建工作区")}</Link>
        </div>
        <ol className="mt-12 grid border border-[#E4E8E5] bg-white sm:grid-cols-2 xl:grid-cols-4">
          {steps.map(([n, title, zhBody, enBody]) => (
            <li key={n} className="border-[#E4E8E5] p-4 xl:border-r xl:last:border-r-0">
              <p className="text-[13px] text-[#5E6B65]">{n}</p>
              <h2 className="mt-2 text-[16px] font-semibold">{title}</h2>
              <p className="mt-2 text-[13px] leading-[1.55] text-[#3F4C46]">{zh ? zhBody : enBody}</p>
            </li>
          ))}
        </ol>
        <section className="mt-12">
          <h2 className="text-[22px] font-semibold">{zh ? "八个岗位。一个批准习惯。" : "Eight desks. One approval habit."}</h2>
          <p className="mt-1 text-[13px] text-[#5E6B65]">{zh ? "每个岗位用字母缩写，不是卡通人物。" : "Each desk is a monogram, not a character."}</p>
          <ul className="mt-4 grid overflow-hidden rounded-[8px] border border-[#E4E8E5] bg-white sm:grid-cols-2">
            {desks.map(([mark, zhName, enName, zhLine, enLine]) => (
              <li key={mark} className="flex gap-3 border-b border-[#E4E8E5] p-4 sm:[&:nth-child(odd)]:border-r">
                <span className="grid size-7 shrink-0 place-items-center rounded-[6px] border border-[#E4E8E5] bg-[#EEF1EF] text-[13px] font-semibold">{mark}</span>
                <div>
                  <h3 className="text-[14px] font-medium">{zh ? `${zhName} ${enName}` : `${enName}`}</h3>
                  <p className="mt-1 text-[13px] leading-[1.55] text-[#3F4C46]">{zh ? zhLine : enLine}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
