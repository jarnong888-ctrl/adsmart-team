import Link from "next/link";
import { Flash } from "@/components/flash";
import { InfoTip, PlatformMark } from "@/components/visual";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/dates";
import { tr } from "@/lib/i18n";
import { CATEGORIES, INTEGRATION_CARDS } from "@/lib/integrations/catalog";
import { MOCK_FOLDERS, MOCK_SHEETS } from "@/lib/integrations/mode";
import { disconnectConnection, saveConnectionTargets } from "@/server/integration-actions";
import { connectionView } from "@/server/integrations";
import { studioContext } from "@/server/context";

const MARK: Record<string, string> = {
  google: "G",
  linkedin: "in",
  x: "X",
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; disconnect?: string }>;
}) {
  const { locale, workspace, user } = await studioContext();
  const sp = await searchParams;
  const rows = await prisma.integration.findMany({ where: { workspaceId: workspace.id } });
  const byProvider = new Map(rows.map((row) => [row.provider, connectionView(row)]));
  const google = byProvider.get("google");
  const canManage = user.platformRole !== "admin";

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <header className="mb-6">
        <h1 className="type-h1 inline-flex items-center gap-2">
          {tr(locale, "Connections", "连接")}
          <InfoTip text={tr(locale, "One Google login covers Drive and Sheets. Buffer and Canva stay on Adsmart.", "一次 Google 登录覆盖 Drive 和表格。Buffer 和 Canva 属于 Adsmart。")} />
        </h1>
      </header>
      {CATEGORIES.map((category) => (
        <section key={category.id} className="mb-8">
          <h2 className="mb-2 text-[13px] font-semibold text-[#1C453A]">{tr(locale, category.en, category.zh)}</h2>
          <div className="overflow-hidden rounded-[8px] border border-[#D5E3DD] bg-white">
            {INTEGRATION_CARDS.filter((card) => card.category === category.id).map((card) => {
              const view = byProvider.get(card.provider) ?? connectionView(undefined);
              const connected = view.status === "connected";
              const status = card.comingSoon ? "soon" : view.status;
              const sync = view.lastSyncAt ? formatWhen(view.lastSyncAt, locale) : "";
              return (
                <div key={card.id} className="flex items-center gap-3 border-b border-[#D5E3DD] px-4 py-3 last:border-0">
                  <Mark provider={card.provider} />
                  <div className="min-w-0 flex-1">
                    <p className="inline-flex items-center gap-1 text-[14px] font-semibold">
                      {locale === "zh" ? card.nameZh : card.nameEn}
                      <InfoTip text={[locale === "zh" ? card.useZh : card.useEn, locale === "zh" ? card.scopesZh : card.scopesEn, sync ? `${tr(locale, "Last sync", "上次同步")} ${sync}` : ""].filter(Boolean).join(" ")} />
                    </p>
                    <p className="truncate text-[13px]">
                      <StatusText locale={locale} status={status} account={view.accountLabel} />
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {card.comingSoon || !canManage ? null : connected ? (
                      <>
                        <Link href={`/api/integrations/${card.provider}/start`} className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#C5D9D1] bg-[#E6F2ED] px-4 text-[14px] font-bold text-[#0B624C]">{tr(locale, "Reconnect", "重连")}</Link>
                        <Link href={`/studio/connections?disconnect=${card.provider}`} className="inline-flex h-8 items-center rounded-[6px] px-2 text-[13px] font-medium text-[#B42318]">{tr(locale, "Disconnect", "断开")}</Link>
                      </>
                    ) : (
                      <Link href={`/api/integrations/${card.provider}/start`} className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#086B54] bg-[#0B624C] px-4 text-[14px] font-bold text-white shadow-[0_1px_0_rgba(8,107,84,0.9),0_1px_2px_rgba(12,46,40,0.18)] hover:bg-[#094E3D]">
                        {view.status === "needs_reconnect" ? tr(locale, "Reconnect", "重连") : tr(locale, "Connect", "连接")}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {google?.status === "connected" && canManage ? (
        <section className="rounded-[8px] border border-[#D5E3DD] bg-white px-4 py-4">
          <h2 className="text-[13px] font-semibold">{tr(locale, "Google destinations", "Google 存放位置")}</h2>
          <form action={saveConnectionTargets} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-[13px] font-medium">
              {tr(locale, "Drive folder", "Drive 文件夹")}
              <select name="driveFolderId" defaultValue={google.settings.driveFolderId || "folder_deliverables"} className="mt-1 h-9 w-full rounded-[6px] border border-[#D5E3DD] bg-white px-2 font-medium">
                {MOCK_FOLDERS.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </label>
            <label className="text-[13px] font-medium">
              {tr(locale, "Sheet", "表格")}
              <select name="sheetId" defaultValue={google.settings.sheetId || ""} className="mt-1 h-9 w-full rounded-[6px] border border-[#D5E3DD] bg-white px-2 font-medium">
                {MOCK_SHEETS.map((sheet) => <option key={sheet.id || "none"} value={sheet.id}>{sheet.name}</option>)}
              </select>
            </label>
            <SubmitButton>{tr(locale, "Save", "保存")}</SubmitButton>
          </form>
        </section>
      ) : null}
      {sp.disconnect && canManage ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#10251F]/35 p-4">
          <div role="dialog" className="w-full max-w-md rounded-[8px] border border-[#D5E3DD] bg-white p-4">
            <h2 className="text-[16px] font-semibold">{tr(locale, "Disconnect this account?", "断开这个账号？")}</h2>
            <p className="mt-1 text-[13px] text-[#3D5C54]">{tr(locale, "Saved tokens are removed.", "已保存的令牌会删掉。")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Link href="/studio/connections" className="inline-flex h-9 items-center rounded-[6px] border border-[#D5E3DD] bg-white px-3 text-[13px]">{tr(locale, "Cancel", "取消")}</Link>
              <form action={disconnectConnection}>
                <input type="hidden" name="provider" value={sp.disconnect} />
                <SubmitButton variant="destructive">{tr(locale, "Disconnect", "断开")}</SubmitButton>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Mark({ provider }: { provider: string }) {
  const social = provider === "tiktok" || provider === "instagram" || provider === "facebook" || provider === "youtube";
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-[6px] border border-[#D5E3DD] bg-[#F2F6F4]">
      {social ? <PlatformMark platform={provider} /> : <span className="text-[13px] font-semibold">{MARK[provider] ?? provider.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

function StatusText({ locale, status, account }: { locale: "en" | "zh"; status: string; account: string }) {
  if (status === "soon") return <span className="text-[#3D5C54]">{tr(locale, "Not available yet", "尚未开放")}</span>;
  if (status === "connected") return <span className="text-[#0B624C]">{tr(locale, `Connected · ${account}`, `已连接 · ${account}`)}</span>;
  if (status === "needs_reconnect") return <span className="text-[#B45309]">{tr(locale, "Needs reconnect", "需要重新连接")}</span>;
  if (status === "error") return <span className="text-[#B42318]">{tr(locale, "Connection error", "连接出错")}</span>;
  return <span className="text-[#3D5C54]">{tr(locale, "Not connected", "未连接")}</span>;
}
