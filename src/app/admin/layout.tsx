import Link from "next/link";
import { redirect } from "next/navigation";
import { LocaleSwitch } from "@/components/locale-switch";
import { SubmitButton } from "@/components/submit-button";
import { tr } from "@/lib/i18n";
import { logout } from "@/server/auth-actions";
import { getLocale, requireUser } from "@/server/guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.platformRole !== "admin") redirect("/studio");
  const locale = await getLocale();
  return (
    <div className="min-h-screen bg-[#F2F6F4] text-[#10251F]">
      <header className="flex h-12 items-center justify-between gap-3 border-b border-[#D5E3DD] bg-white px-4">
        <Link href="/admin" className="flex items-center gap-2 text-[14px] font-semibold">
          <span className="grid size-5 place-items-center rounded-[4px] bg-[#0B624C] text-[13px] text-white">A</span>
          Adsmart Team · {tr(locale, "Staff", "内部")}
        </Link>
        <nav className="flex items-center gap-4 text-[13px]">
          <Link href="/admin/analytics" className="text-[#1C453A] hover:text-[#10251F]">{tr(locale, "Analytics", "数据")}</Link>
          <Link href="/admin/billing" className="text-[#1C453A] hover:text-[#10251F]">{tr(locale, "Credits and revenue", "点数和收入")}</Link>
        </nav>
        <div className="flex items-center gap-3">
          <LocaleSwitch locale={locale} />
          <span className="text-sm">{user.name}</span>
          <form action={logout}>
            <SubmitButton variant="ghost">{tr(locale, "Log out", "退出")}</SubmitButton>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
