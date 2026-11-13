import Link from "next/link";
import { SplitBar } from "@/components/bar-chart";
import { InfoTip } from "@/components/visual";
import { tr, type Locale } from "@/lib/i18n";
import type { AnalyticsRange, AnalyticsReport } from "@/lib/demo-analytics";

const NAMES: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
};

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function AnalyticsDashboard({
  locale,
  report,
  hrefBase,
  title,
  lede,
}: {
  locale: Locale;
  report: AnalyticsReport;
  hrefBase: string;
  title: string;
  lede: string;
}) {
  const ranges: AnalyticsRange[] = [7, 30, 90];
  const kpis = [
    { label: tr(locale, "Followers", "粉丝"), value: report.followers.toLocaleString(), hint: tr(locale, "Latest on the goal platform", "目标平台的最新粉丝") },
    {
      label: tr(locale, "Growth", "增长"),
      value: `${report.followerGrowth >= 0 ? "+" : ""}${report.followerGrowth.toLocaleString()}`,
      hint: tr(locale, `Goal line ${report.expectedGrowth >= 0 ? "+" : ""}${report.expectedGrowth.toLocaleString()}`, `目标线 ${report.expectedGrowth >= 0 ? "+" : ""}${report.expectedGrowth.toLocaleString()}`),
      warn: report.followerGrowth < report.expectedGrowth,
    },
    { label: tr(locale, "Views", "播放"), value: report.views.toLocaleString(), hint: tr(locale, "New views in the range", "这段时间新增播放") },
    { label: tr(locale, "Engagement", "互动率"), value: pct(report.engagementRate), hint: tr(locale, "Likes, comments, and shares / views", "点赞、评论、转发 / 播放") },
    { label: tr(locale, "Posts", "已发布"), value: String(report.postsPublished), hint: tr(locale, "Published in this range", "这段时间发布") },
    { label: tr(locale, "Credits", "点数"), value: report.creditsRemaining.toLocaleString(), hint: tr(locale, `${report.creditsUsed.toLocaleString()} used · remaining now`, `本段用了 ${report.creditsUsed.toLocaleString()} · 现在剩余`) },
  ];

  return (
    <div>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="type-h1 inline-flex items-center gap-2">
          {title}
          <InfoTip text={lede} />
        </h1>
        <div className="flex h-8 shrink-0 rounded-[6px] border border-[#E4E8E5] bg-white p-0.5" role="group" aria-label={tr(locale, "Date range", "时间范围")}>
          {ranges.map((days) => (
            <Link
              key={days}
              href={`${hrefBase}?range=${days}`}
              aria-current={report.range === days ? "true" : undefined}
              className={`inline-flex h-7 items-center rounded-[6px] px-2.5 text-[13px] font-semibold ${report.range === days ? "bg-[#0F6B4F] text-white" : "text-[#5E6B65] hover:bg-[#E9F4EE] hover:text-[#0F6B4F]"}`}
            >
              {days}{tr(locale, "d", "天")}
            </Link>
          ))}
        </div>
      </header>

      <section className="overflow-hidden rounded-[8px] border border-[#E4E8E5] bg-white">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <article key={kpi.label} className="border-r border-b border-[#E4E8E5] px-4 py-4 xl:border-b-0">
              <p className="inline-flex items-center gap-1 text-[13px] font-medium text-[#5E6B65]">
                {kpi.label}
                <InfoTip text={kpi.hint} />
              </p>
              <p className={`nums mt-2 text-[28px] leading-none font-semibold ${kpi.warn ? "text-[#B45309]" : "text-[#14201B]"}`}>{kpi.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-[8px] border border-[#E4E8E5] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-h2">{tr(locale, "Followers vs goal", "粉丝与目标")}</h2>
          <p className="inline-flex items-center gap-3 text-[13px] font-medium text-[#5E6B65]">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-[#0F6B4F]" />{tr(locale, "Recorded", "记录")}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-0 w-4 border-t border-dashed border-[#5E7D74]" />{tr(locale, "Goal", "目标")}</span>
          </p>
        </div>
        <TrendChart trend={report.trend} locale={locale} label={tr(locale, "Follower trend", "粉丝趋势")} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[8px] border border-[#E4E8E5] bg-white px-4 py-3">
          <h2 className="text-[13px] font-semibold">{tr(locale, "By platform", "按平台")}</h2>
          <table className="mt-2 w-full text-left text-[13px]">
            <thead className="text-[13px] text-[#5E6B65]">
              <tr>
                <th className="py-1 font-medium">{tr(locale, "Platform", "平台")}</th>
                <th className="py-1 text-right font-medium">{tr(locale, "Followers", "粉丝")}</th>
                <th className="py-1 text-right font-medium">{tr(locale, "Views", "播放")}</th>
                <th className="py-1 text-right font-medium">{tr(locale, "Eng.", "互动")}</th>
              </tr>
            </thead>
            <tbody>
              {report.platforms.map((row) => (
                <tr key={row.platform} className="border-t border-[#E4E8E5]">
                  <td className="py-2 font-medium">{NAMES[row.platform] ?? row.platform}</td>
                  <td className="nums py-2 text-right">{row.followers.toLocaleString()}</td>
                  <td className="nums py-2 text-right">{row.views.toLocaleString()}</td>
                  <td className="nums py-2 text-right">{pct(row.engagementRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-[8px] border border-[#E4E8E5] bg-white px-4 py-3">
          <h2 className="text-[13px] font-semibold">{tr(locale, "Content mix", "内容配比")}</h2>
          <div className="mt-4">
            <SplitBar
              label={tr(locale, "Content mix by views", "按播放的内容配比")}
              parts={[
                { label: tr(locale, "Mindset", "心态"), value: report.mix.find((row) => row.pillar === "mindset")?.views ?? 0, className: "bg-[#0C2E28]" },
                { label: tr(locale, "Practical", "实操"), value: report.mix.find((row) => row.pillar === "practical")?.views ?? 0, className: "bg-[#0F6B4F]" },
                { label: tr(locale, "Trends", "趋势"), value: report.mix.find((row) => row.pillar === "trends")?.views ?? 0, className: "bg-[#1A7A5E]" },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[8px] border border-[#E4E8E5] bg-white px-4 py-3">
        <h2 className="text-[13px] font-semibold">{tr(locale, "Top posts", "表现最好")}</h2>
        {report.topPosts.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#5E6B65]">{tr(locale, "No views yet.", "还没有播放。")}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[13px]">
              <thead className="text-[13px] text-[#5E6B65]">
                <tr>
                  <th className="py-1 font-medium">{tr(locale, "Post", "内容")}</th>
                  <th className="py-1 font-medium">{tr(locale, "Pillar", "栏目")}</th>
                  <th className="py-1 text-right font-medium">{tr(locale, "Views", "播放")}</th>
                </tr>
              </thead>
              <tbody>
                {report.topPosts.map((post) => (
                  <tr key={post.id} className="border-t border-[#E4E8E5]">
                    <td className="py-2 font-medium">
                      {post.title}
                      {post.workspaceName ? <span className="mt-0.5 block text-[13px] text-[#5E6B65]">{post.workspaceName}</span> : null}
                    </td>
                    <td className="py-2 text-[#3F4C46]">{post.pillar}</td>
                    <td className="nums py-2 text-right">{post.views.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function TrendChart({
  trend,
  label,
  locale,
}: {
  trend: { date: string; followers: number; goal: number }[];
  label: string;
  locale: Locale;
}) {
  if (trend.length < 2) {
    return <p className="mt-4 text-[16px] text-[#5E6B65]">{label}</p>;
  }
  const width = 720;
  const height = 280;
  const pad = 24;
  const followerValues = trend.map((point) => point.followers);
  const followerMax = Math.max(...followerValues);
  const goalMax = Math.max(...trend.map((point) => point.goal));
  const goalInFrame = goalMax <= followerMax * 2.5;
  const values = goalInFrame ? trend.flatMap((point) => [point.followers, point.goal]) : followerValues;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const x = (index: number) => pad + (index / (trend.length - 1)) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2);
  const line = (key: "followers" | "goal") => trend.map((point, index) => `${x(index)},${y(point[key])}`).join(" ");
  const ticks = 4;
  return (
    <>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-72 w-full" role="img" aria-label={label}>
        {Array.from({ length: ticks + 1 }, (_, index) => {
          const yy = pad + ((height - pad * 2) / ticks) * index;
          return <line key={yy} x1={pad} x2={width - pad} y1={yy} y2={yy} stroke="#E4E8E5" strokeWidth="1" />;
        })}
        {goalInFrame ? <polyline fill="none" stroke="#5E7D74" strokeDasharray="4 4" strokeWidth="1.5" points={line("goal")} /> : null}
        <polyline fill="none" stroke="#0F6B4F" strokeWidth="2.25" points={line("followers")} />
      </svg>
      {goalInFrame ? null : (
        <p className="text-[13px] font-medium text-[#5E6B65]">
          {tr(locale, `Goal ${trend.at(-1)?.goal.toLocaleString()} is above this scale. Recorded ${trend.at(-1)?.followers.toLocaleString()}.`, `目标 ${trend.at(-1)?.goal.toLocaleString()} 高于刻度。记录 ${trend.at(-1)?.followers.toLocaleString()}。`)}
        </p>
      )}
    </>
  );
}
