import Link from "next/link";
import { BarChart } from "@/components/bar-chart";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { addDays, kualaLumpurDate } from "@/lib/dates";
import { healthLabel, tr } from "@/lib/i18n";
import { assessHealth } from "@/lib/recommendations";
import { loadUsageProfile } from "@/server/profile";
import { platformServices } from "@/lib/integrations/platform-services";
import { getLocale } from "@/server/guard";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const locale = await getLocale();
  const sp = await searchParams;
  const workspaces = await prisma.workspace.findMany({
    include: { members: { include: { user: true } }, integrations: true },
    orderBy: { name: "asc" },
  });
  const services = platformServices();
  const trendStart = new Date(new Date().getTime() - 13 * 24 * 60 * 60 * 1000);
  const generated = await prisma.usageEvent.findMany({
    where: { kind: "content_generated", createdAt: { gte: trendStart } },
    select: { createdAt: true, quantity: true },
  });
  const today = kualaLumpurDate(new Date());
  const trend = Array.from({ length: 14 }, (_, index) => {
    const label = addDays(today, index - 13);
    const value = generated
      .filter((event) => kualaLumpurDate(event.createdAt) === label)
      .reduce((sum, event) => sum + event.quantity, 0);
    return { label, value };
  });
  const rows = await Promise.all(
    workspaces.map(async (workspace) => {
      const loaded = await loadUsageProfile(workspace.id);
      const health = assessHealth(loaded.profile);
      const drafts = await prisma.recommendation.count({ where: { workspaceId: workspace.id, status: "draft" } });
      return { workspace, loaded, health, drafts };
    }),
  );

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        eyebrow={tr(locale, "Adsmart staff", "Adsmart 内部")}
        title={tr(locale, "Usage and health", "用量和健康度")}
        lede={tr(
          locale,
          "Clients never see this page, and they only see a recommendation after you send it. Low engagement and churn are rules, not a model score.",
          "客户看不到这一页。建议也要等你发出去，他们才看得到。参与度低和流失风险是规则，不是模型打分。",
        )}
      />
      <section className="mb-6 rounded-[8px] border border-[#D5E3DD] bg-white p-4">
        <h2 className="type-h2">{tr(locale, "Platform services", "平台服务")}</h2>
        <p className="type-caption mt-1">{tr(locale, "Adsmart keys. Clients do not connect these.", "Adsmart 的密钥。客户不连接。")}</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {services.map((service) => (
            <li key={service.id} className="rounded-[6px] border border-[#D5E3DD] px-3 py-2">
              <p className="text-[14px] font-medium">{tr(locale, service.nameEn, service.nameZh)}</p>
              <p className="mt-1 text-[13px] text-[#3D5C54]">{service.id === "buffer" ? tr(locale, "Posts to client socials", "发到客户社交账号") : tr(locale, "Design account", "设计账号")}</p>
              <p className="mt-2 text-[13px] text-[#0B624C]">{service.status === "configured" ? tr(locale, "Configured from env", "已用环境变量配置") : service.status === "mock" ? tr(locale, "Mock key", "模拟密钥") : tr(locale, "Missing key", "缺少密钥")}</p>
            </li>
          ))}
        </ul>
      </section>
      <div className="overflow-x-auto rounded-[8px] border border-[#D5E3DD] bg-white">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">{tr(locale, "Workspace", "工作区")}</th>
              <th className="py-2 pr-3 font-medium">{tr(locale, "Plan", "方案")}</th>
              <th className="py-2 pr-3 font-medium">{tr(locale, "Health", "健康")}</th>
              <th className="py-2 pr-3 font-medium">{tr(locale, "This week", "本周")}</th>
              <th className="py-2 pr-3 font-medium">{tr(locale, "Followers", "粉丝")}</th>
              <th className="py-2 pr-3 font-medium">{tr(locale, "Quiet", "安静")}</th>
              <th className="py-2 pr-3 font-medium">{tr(locale, "Connections", "连接")}</th>
              <th className="py-2 font-medium">{tr(locale, "Drafts", "草稿")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ workspace, loaded, health, drafts }) => {
              const owner = workspace.members.find((member) => member.role === "owner")?.user;
              return (
                <tr key={workspace.id} className={`border-t border-[#D5E3DD] align-top ${health.health === "churn_risk" ? "border-l-[3px] border-l-[#B45309]" : ""}`}>
                  <td className="px-4 py-3">
                    <Link className="font-medium text-[#10251F] no-underline" href={`/admin/workspaces/${workspace.id}`}>{workspace.name}</Link>
                    <p className="text-[13px] text-[#3D5C54]">{owner?.name} · {owner?.email}</p>
                  </td>
                  <td className="px-3 py-3 text-[13px]">{workspace.planCode}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex h-5 items-center rounded-[4px] border px-1.5 text-[13px] font-medium ${health.health === "churn_risk" ? "border-[#EED6A3] bg-[#FDF6E7] text-[#B45309]" : "border-[#C5E0D4] bg-[#E6F2ED] text-[#0B624C]"}`}>
                      {healthLabel(locale, health.health)}
                    </span>
                    <p className="mt-1 max-w-64 text-[13px] text-[#3D5C54]">{health.signals.join(" · ") || "—"}</p>
                  </td>
                  <td className="py-3 pr-3">{loaded.profile.videosThisWeek}/{loaded.profile.videosPerWeekLimit}</td>
                  <td className="py-3 pr-3">{loaded.profile.followerLatest.toLocaleString()}</td>
                  <td className="py-3 pr-3">{loaded.profile.daysSinceLastActivity ?? "—"}d</td>
                  <td className="py-3 pr-3 text-[13px] text-[#1C453A]">{workspace.integrations.filter((row) => row.status === "connected").map((row) => row.provider).join(", ") || tr(locale, "None", "无")}</td>
                  <td className="py-3">{drafts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="mt-6 rounded-[8px] border border-[#D5E3DD] bg-white p-4">
        <h2 className="text-[14px] font-semibold">{tr(locale, "Videos generated, 14 days", "近 14 天生成的视频")}</h2>
        <div className="mt-3">
          <BarChart rows={trend} label={tr(locale, "Videos generated per day", "每天生成的视频")} />
        </div>
      </section>
    </div>
  );
}
