import Link from "next/link";
import { LocaleSwitch } from "@/components/locale-switch";
import { Flash } from "@/components/flash";
import { SubmitButton } from "@/components/submit-button";
import { tr } from "@/lib/i18n";
import { signup } from "@/server/auth-actions";
import { getLocale } from "@/server/guard";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const locale = await getLocale();
  const sp = await searchParams;
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#F6F7F5] px-5 py-8 text-[#14201B]">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-[14px] font-semibold text-[#14201B] no-underline">
          <span className="grid size-5 place-items-center rounded-[4px] bg-[#0F6B4F] text-[13px] text-white">A</span>
          Adsmart Team
        </Link>
        <LocaleSwitch locale={locale} />
      </div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <h1 className="text-[28px] leading-[1.3] font-semibold">{tr(locale, "Start a workspace", "创建工作区")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{tr(locale, "Free starter credits. No card.", "免费起步点数。不需要卡。")}</p>
      <form action={signup} className="mt-6 space-y-3">
        <label className="block text-sm">
          {tr(locale, "Your name", "你的名字")}
          <input name="name" required className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3" />
        </label>
        <label className="block text-sm">
          {tr(locale, "Email", "邮箱")}
          <input name="email" type="email" required className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3" />
        </label>
        <label className="block text-sm">
          {tr(locale, "Password", "密码")}
          <input name="password" type="password" minLength={8} required className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3" />
        </label>
        <label className="block text-sm">
          {tr(locale, "Business name", "商家名称")}
          <input name="workspace" required className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3" />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" className="mt-1" />
          <span>
            {tr(
              locale,
              "I agree that Adsmart may store usage events for this workspace to run analytics and recommendations. I can export or delete the data later. Content is stored either way.",
              "我同意 Adsmart 保存这个工作区的使用记录，用来做数据和建议。之后我可以导出或删除。内容本身无论如何都会保存。",
            )}
          </span>
        </label>
        <SubmitButton>{tr(locale, "Create the workspace", "建立工作区")}</SubmitButton>
      </form>
      <p className="mt-6 text-sm">
        <Link className="underline" href="/login">{tr(locale, "I already have an account", "我已经有账号")}</Link>
      </p>
    </div>
  );
}
