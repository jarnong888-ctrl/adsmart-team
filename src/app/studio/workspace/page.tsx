import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SetupWizard } from "@/components/setup-wizard";
import { SubmitButton } from "@/components/submit-button";
import { parsePlatforms } from "@/lib/platforms";
import { planByCode } from "@/lib/plans";
import { tr } from "@/lib/i18n";
import { createWorkspace, saveWorkspace } from "@/server/studio-actions";
import { getLocale, requireUser, resolveWorkspaces } from "@/server/guard";

const control = "mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; guide?: string }>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const sp = await searchParams;
  const { current } = await resolveWorkspaces(user.id);
  const platforms = new Set(current ? parsePlatforms(current.platforms) : ["tiktok"]);
  const plan = current ? planByCode(current.planCode) : null;
  const incomplete = current ? !current.industry || !current.audience || !current.offers : false;
  const showGuide = current && (incomplete || sp.guide === "1");

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        eyebrow={tr(locale, "Workspace", "工作区")}
        title={current ? current.name : tr(locale, "Create a workspace", "建立一个工作区")}
        lede={tr(locale, "This is the business the team writes for: who it serves, what it sells, and how often it can film.", "这是团队要为之写内容的那门生意：服务谁、卖什么、一周能拍多少。")}
      />
      {showGuide && current ? (
        <SetupWizard
          locale={locale}
          profile={{
            name: current.name,
            handle: current.handle,
            industry: current.industry,
            audience: current.audience,
            offers: current.offers,
            tone: current.tone,
            primaryLanguage: current.primaryLanguage,
            platforms: [...platforms],
            goalFollowers: current.goalFollowers,
            goalPlatform: current.goalPlatform,
            goalHorizonDays: current.goalHorizonDays,
            baselineFollowers: current.baselineFollowers,
            baselineOn: current.baselineOn,
            postingCapacity: current.postingCapacity,
            mixMindset: current.mixMindset,
            mixPractical: current.mixPractical,
            mixTrends: current.mixTrends,
            softSellRatio: current.softSellRatio,
          }}
        />
      ) : null}
      {current && !showGuide ? (
        <p className="mb-4 text-sm">
          <a className="underline" href="/studio/workspace?guide=1">{tr(locale, "Open the guided setup", "打开引导设置")}</a>
        </p>
      ) : null}
      {current && plan && !showGuide ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {tr(locale, `Production cap: ${plan.videosPerWeek} videos a week. AI actions spend credits.`, `产量上限：每周 ${plan.videosPerWeek} 条。AI 动作按点数扣。`)}{" "}
          <a className="underline" href="/studio/credits">{tr(locale, "Reload credits", "充值")}</a>
        </p>
      ) : null}
      {current && !showGuide ? (
        <form action={saveWorkspace} className="grid max-w-3xl gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            {tr(locale, "Business name", "商家名称")}
            <input className={control} name="name" defaultValue={current.name} required />
          </label>
          <label className="text-sm">
            {tr(locale, "Handle", "账号")}
            <input className={control} name="handle" defaultValue={current.handle} />
          </label>
          <label className="text-sm">
            {tr(locale, "Content language", "内容语言")}
            <select className={control} name="primaryLanguage" defaultValue={current.primaryLanguage}>
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="ms">Bahasa Melayu</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            {tr(locale, "Industry", "行业")}
            <input className={control} name="industry" defaultValue={current.industry} />
          </label>
          <label className="text-sm sm:col-span-2">
            {tr(locale, "Audience", "受众")}
            <input className={control} name="audience" defaultValue={current.audience} />
          </label>
          <label className="text-sm sm:col-span-2">
            {tr(locale, "Offers and funnel", "产品与漏斗")}
            <textarea className="mt-1 min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm" name="offers" defaultValue={current.offers} />
          </label>
          <label className="text-sm sm:col-span-2">
            {tr(locale, "Tone", "语气")}
            <input className={control} name="tone" defaultValue={current.tone} />
          </label>
          <fieldset className="text-sm sm:col-span-2">
            <legend>{tr(locale, "Platforms", "平台")}</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {["tiktok", "instagram", "facebook"].map((platform) => (
                <label key={platform} className="flex items-center gap-2">
                  <input type="checkbox" name={`platform_${platform}`} defaultChecked={platforms.has(platform)} />
                  {platform}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="text-sm">
            {tr(locale, "Goal followers", "粉丝目标")}
            <input className={control} type="number" name="goalFollowers" defaultValue={current.goalFollowers} />
          </label>
          <label className="text-sm">
            {tr(locale, "Goal platform", "目标平台")}
            <select className={control} name="goalPlatform" defaultValue={current.goalPlatform}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
          </label>
          <label className="text-sm">
            {tr(locale, "Horizon, days", "期限（天）")}
            <input className={control} type="number" name="goalHorizonDays" defaultValue={current.goalHorizonDays} />
          </label>
          <label className="text-sm">
            {tr(locale, "Baseline followers", "起始粉丝")}
            <input className={control} type="number" name="baselineFollowers" defaultValue={current.baselineFollowers} />
          </label>
          <label className="text-sm">
            {tr(locale, "Baseline date", "起始日期")}
            <input className={control} type="date" name="baselineOn" defaultValue={current.baselineOn} />
          </label>
          <label className="text-sm">
            {tr(locale, "Videos / week", "每周条数")}
            <input className={control} type="number" name="postingCapacity" defaultValue={current.postingCapacity} />
          </label>
          <label className="text-sm">
            {tr(locale, "Mindset %", "心态 %")}
            <input className={control} type="number" name="mixMindset" defaultValue={current.mixMindset} />
          </label>
          <label className="text-sm">
            {tr(locale, "Practical %", "实操 %")}
            <input className={control} type="number" name="mixPractical" defaultValue={current.mixPractical} />
          </label>
          <label className="text-sm">
            {tr(locale, "Trends %", "趋势 %")}
            <input className={control} type="number" name="mixTrends" defaultValue={current.mixTrends} />
          </label>
          <label className="text-sm">
            {tr(locale, "Soft-sell %", "软性销售 %")}
            <input className={control} type="number" name="softSellRatio" defaultValue={current.softSellRatio} />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton>{tr(locale, "Save workspace", "保存工作区")}</SubmitButton>
          </div>
        </form>
      ) : null}
      <form action={createWorkspace} className="mt-10 max-w-md space-y-3 border-t border-border pt-6">
        <h2 className="text-xl">{tr(locale, "Another workspace", "再建一个工作区")}</h2>
        <label className="block text-sm">
          {tr(locale, "Name", "名称")}
          <input className={control} name="name" required />
        </label>
        <SubmitButton variant="outline">{tr(locale, "Create", "建立")}</SubmitButton>
      </form>
    </div>
  );
}
