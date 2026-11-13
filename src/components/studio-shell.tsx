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
    <div className="min-h-screen bg-[#F2F6F4] text-[#10251F]">
      <div className="md:grid md:grid-cols-[232px_1fr]">
        <aside className="hidden min-h-screen border-r border-[#D5E3DD] bg-white md:flex md:flex-col">
          <div className="flex h-12 items-center gap-2 px-3">
            <span className="grid size-5 place-items-center rounded-[4px] bg-[#0B624C] text-[13px] font-semibold text-white">A</span>
            <span className="text-[14px] font-semibold">Adsmart Team</span>
          </div>
          {current ? (
            <form action={switchWorkspace} className="mx-2 mb-2 flex items-center gap-2 rounded-[6px] border border-[#D5E3DD] px-2 py-1.5">
              <span className="grid size-6 place-items-center rounded-[6px] border border-[#D5E3DD] bg-[#E7F1EC] text-[13px] font-semibold">{mono}</span>
              <label className="sr-only" htmlFor="workspaceId">{tr(locale, "Workspace", "工作区")}</label>
              <select id="workspaceId" name="workspaceId" defaultValue={current.id} className="h-7 min-w-0 flex-1 bg-transparent text-[13px] outline-none">
                {memberships.map((member) => (
                  <option key={member.workspaceId} value={member.workspaceId}>{member.workspace.name}</option>
                ))}
              </select>
              <SubmitButton variant="ghost">{tr(locale, "Open", "打开")}</SubmitButton>
            </form>
          ) : null}
          <p className="px-4 pb-2 text-[13px] text-[#3D5C54]">
            {current ? `${balance} ${tr(locale, "credits", "点")} · ${llm.mode === "mock" ? tr(locale, "Simulated data", "模拟数据") : tr(locale, "Live model", "实时模型")}` : ""}
          </p>
          <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Studio">
            <DeskNav items={NAV.map((item) => ({ href: item.href, label: tr(locale, item.en, item.zh), icon: item.icon, badge: item.badge === "posts" ? pendingPosts : 0 }))} />
            <div className="my-2 border-t border-[#D5E3DD]" />
            <DeskNav items={FOOT.map((item) => ({ href: item.href, label: tr(locale, item.en, item.zh), icon: item.icon }))} />
          </nav>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-[#D5E3DD] bg-white px-4">
            <div className="flex min-w-0 items-center gap-2">
              <MobileNav items={items} label={tr(locale, "Menu", "菜单")} />
              <span className="grid size-5 place-items-center rounded-[4px] bg-[#0B624C] text-[13px] font-semibold text-white md:hidden">A</span>
              <ShellTop locale={locale} />
            </div>
            <div className="flex items-center gap-2">
              <LocaleSwitch locale={locale} />
              <span className="hidden items-center gap-1.5 text-[13px] text-[#1C453A] sm:flex">
                <span className="grid size-6 place-items-center rounded-[6px] border border-[#D5E3DD] bg-[#E7F1EC] text-[13px] font-semibold">{user.name.slice(0, 1)}</span>
                {user.name}
              </span>
              <form action={logout}>
                <SubmitButton variant="ghost">{tr(locale, "Log out", "退出")}</SubmitButton>
              </form>
            </div>
          </header>
          <main className="px-4 py-6 md:px-7 md:py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

