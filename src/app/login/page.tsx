import Link from "next/link";
import { LocaleSwitch } from "@/components/locale-switch";
import { Flash } from "@/components/flash";
import { SubmitButton } from "@/components/submit-button";
import { tr } from "@/lib/i18n";
import { login } from "@/server/auth-actions";
import { getLocale } from "@/server/guard";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; next?: string }>;
}) {
  const locale = await getLocale();
  const sp = await searchParams;
  const next = sp.next && (sp.next.startsWith("/studio") || sp.next.startsWith("/admin")) ? sp.next : "/studio";
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
      <h1 className="type-display">{tr(locale, "Log in", "登录")}</h1>
      <form action={login} className="mt-6 space-y-3">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm">
          {tr(locale, "Email", "邮箱")}
          <input name="email" type="email" required className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3" />
        </label>
        <label className="block text-sm">
          {tr(locale, "Password", "密码")}
          <input name="password" type="password" required className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3" />
        </label>
        <SubmitButton>{tr(locale, "Continue", "继续")}</SubmitButton>
      </form>
      <div className="mt-8 space-y-2 rounded-[8px] border border-border bg-card p-4 text-sm">
        <p className="font-medium">{tr(locale, "Demo logins", "演示账号")}</p>
        <Demo email="demo@adsmart.my" password="studio-demo" label={tr(locale, "Jarno's workspace", "Jarno 的工作区")} nextPath="/studio" />
        <Demo email="owner@kedairasa.example" password="studio-demo" label={tr(locale, "Quiet bakery", "安静的面包店")} nextPath="/studio" />
        <Demo email="hello@batikandco.example" password="studio-demo" label={tr(locale, "Retail store at the cap", "顶到上限的零售店")} nextPath="/studio" />
        <Demo email="admin@adsmart.my" password="studio-admin" label={tr(locale, "Adsmart staff", "Adsmart 内部")} nextPath="/admin" />
      </div>
      <p className="mt-6 text-sm">
        <Link className="underline" href="/signup">{tr(locale, "Create an account", "建立账号")}</Link>
      </p>
    </div>
  );
}

function Demo({ email, password, label, nextPath }: { email: string; password: string; label: string; nextPath: string }) {
  return (
    <form action={login} className="flex items-center justify-between gap-3 border-t border-border pt-2">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="password" value={password} />
      <input type="hidden" name="next" value={nextPath} />
      <span>
        <span className="block">{label}</span>
        <span className="text-xs text-muted-foreground">{email} · {password}</span>
      </span>
      <SubmitButton variant="outline">{label.startsWith("Adsmart") || label.includes("内部") ? "Staff" : "Open"}</SubmitButton>
    </form>
  );
}
