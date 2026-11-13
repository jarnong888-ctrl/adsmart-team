import { redirect } from "next/navigation";
import { DeskNav } from "@/components/desk-nav";
import { LocaleSwitch } from "@/components/locale-switch";
import { MobileNav } from "@/components/mobile-nav";
import { ShellTop } from "@/components/shell-top";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { tr, type Locale } from "@/lib/i18n";
import { llmStatus } from "@/lib/llm";
import { ensureWallet } from "@/server/credits";
import { logout, switchWorkspace } from "@/server/auth-actions";
import { getLocale, requireUser, resolveWorkspaces } from "@/server/guard";

const NAV: { href: string; en: string; zh: string; icon: string; badge?: "posts" }[] = [
  { href: "/studio", en: "Today", zh: "今天", icon: "house" },
  { href: "/studio/pipeline", en: "Pipeline", zh: "流水线", icon: "columns" },
  { href: "/studio/strategist", en: "Strategy", zh: "策略", icon: "map" },
  { href: "/studio/scripts", en: "Scripts", zh: "脚本", icon: "file" },
  { href: "/studio/repurpose", en: "Repurpose", zh: "改写", icon: "repeat" },
  { href: "/studio/editor", en: "Editor", zh: "剪辑", icon: "clapper" },
  { href: "/studio/schedule", en: "Schedule", zh: "排期", icon: "calendar", badge: "posts" },
  { href: "/studio/analytics", en: "Analytics", zh: "数据", icon: "chart" },
  { href: "/studio/connections", en: "Connections", zh: "连接", icon: "plug" },
  { href: "/studio/competitors", en: "Insights", zh: "观察", icon: "eye" },
];

const FOOT = [
  { href: "/studio/credits", en: "Reload credits", zh: "充值", icon: "wallet" },
  { href: "/studio/workspace", en: "Workspace", zh: "工作区", icon: "settings" },
  { href: "/studio/privacy", en: "Privacy", zh: "隐私", icon: "shield" },
];

export async function StudioShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale: Locale = await getLocale();
  const { memberships, current } = await resolveWorkspaces(user.id);
  if (!current && user.platformRole === "admin") redirect("/admin");
  const pendingPosts = current
    ? await prisma.scheduleEntry.count({ where: { workspaceId: current.id, status: "pending_approval" } })
    : 0;
  const balance = current ? (await ensureWallet(current.id)).balance : null;
  const llm = llmStatus();
  const items = [...NAV, ...FOOT].map((item) => ({
    href: item.href,
    label: tr(locale, item.en, item.zh),
    badge: "badge" in item && item.badge === "posts" ? pendingPosts : undefined,
  }));
  const mono = (current?.name || user.name).slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F6F7F5] text-[#14201B]">
      <div className="md:grid md:grid-cols-[232px_1fr]">
        <aside className="hidden min-h-screen border-r border-[#E4E8E5] bg-white md:flex md:flex-col">
          <div className="flex h-14 items-center gap-2.5 px-4">
            <span className="grid size-7 place-items-center rounded-[8px] bg-[#0F6B4F] text-[14px] font-semibold text-white">A</span>
            <span className="text-[15px] font-semibold tracking-[-0.01em]">Adsmart Team</span>
          </div>
          {current ? (
            <form action={switchWorkspace} className="mx-3 mb-1 rounded-[12px] border border-[#E4E8E5] bg-[#FAFBFA] p-2.5">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#E9F4EE] text-[12px] font-semibold text-[#0B5A42]">{mono}</span>
                <label className="sr-only" htmlFor="workspaceId">{tr(locale, "Workspace", "工作区")}</label>
                <select id="workspaceId" name="workspaceId" defaultValue={current.id} className="h-7 min-w-0 flex-1 truncate bg-transparent text-[14px] font-medium outline-none">
                  {memberships.map((member) => (
                    <option key={member.workspaceId} value={member.workspaceId}>{member.workspace.name}</option>
                  ))}
                </select>
                {memberships.length > 1 ? <SubmitButton variant="ghost" size="sm">{tr(locale, "Switch", "切换")}</SubmitButton> : null}
              </div>
              <p className="mt-1.5 text-[12px] leading-tight text-[#5E6B65]">
                <span className="nums text-[#14201B]">{balance}</span> {tr(locale, "credits", "点")} · {llm.mode === "mock" ? tr(locale, "Simulated data", "模拟数据") : tr(locale, "Live model", "实时模型")}
              </p>
            </form>
          ) : null}
          <div className="h-3" />
          <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4" aria-label="Studio">
            <DeskNav items={NAV.map((item) => ({ href: item.href, label: tr(locale, item.en, item.zh), icon: item.icon, badge: item.badge === "posts" ? pendingPosts : 0 }))} />
            <div className="mx-1 my-3 border-t border-[#E4E8E5]" />
            <DeskNav items={FOOT.map((item) => ({ href: item.href, label: tr(locale, item.en, item.zh), icon: item.icon }))} />
          </nav>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[#E4E8E5] bg-white/85 px-4 backdrop-blur md:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <MobileNav items={items} label={tr(locale, "Menu", "菜单")} />
              <span className="grid size-5 place-items-center rounded-[4px] bg-[#0F6B4F] text-[13px] font-semibold text-white md:hidden">A</span>
              <ShellTop locale={locale} />
            </div>
            <div className="flex items-center gap-2">
              <LocaleSwitch locale={locale} />
              <span className="hidden items-center gap-1.5 text-[13px] text-[#3F4C46] sm:flex">
                <span className="grid size-7 place-items-center rounded-full bg-[#E9F4EE] text-[12px] font-semibold text-[#0B5A42]">{user.name.slice(0, 1)}</span>
                {user.name}
              </span>
              <form action={logout}>
                <SubmitButton variant="ghost">{tr(locale, "Log out", "退出")}</SubmitButton>
              </form>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

