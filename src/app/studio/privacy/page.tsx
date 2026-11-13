import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { tr } from "@/lib/i18n";
import { deleteAccount, deleteWorkspace, setConsent } from "@/server/studio-actions";
import { getLocale, requireUser, resolveWorkspaces } from "@/server/guard";

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const sp = await searchParams;
  const { current } = await resolveWorkspaces(user.id);

  return (
    <div className="max-w-3xl">
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        eyebrow={tr(locale, "Privacy", "隐私")}
        title={tr(locale, "Your workspace data stays in your workspace", "你的工作区数据只留在你的工作区")}
        lede={tr(
          locale,
          "Malaysia's PDPA asks for a clear purpose, a real choice about usage analytics, and a way to take the data out or delete it. This page is that choice. It is not a legal opinion.",
          "马来西亚的个人资料保护法要求目的清楚、使用分析要有真实的选择，并且可以导出或删除。这一页就是那个选择。它不是法律意见。",
        )}
      />
      {current ? (
        <section className="space-y-4 rounded-[8px] border border-border bg-card p-4">
          <form action={setConsent} className="space-y-3">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="consent" defaultChecked={current.analyticsConsent} className="mt-1" />
              <span>
                {tr(
                  locale,
                  "Adsmart may store usage events for this workspace — content generated, approvals, queues, platforms, and which desks were opened — to show health and recommend a next step. Content itself is stored either way, because that is the product.",
                  "Adsmart 可以保存这个工作区的使用记录：生成了什么、批准了什么、排了什么、用了哪些平台、打开了哪些角色，用来看健康度和建议下一步。内容本身无论如何都会保存，因为那就是这个产品。",
                )}
              </span>
            </label>
            <SubmitButton variant="outline">{tr(locale, "Update consent", "更新同意")}</SubmitButton>
          </form>
          <p>
            <a className="text-sm underline" href={`/api/privacy/export?workspaceId=${current.id}`}>
              {tr(locale, "Download this workspace as JSON", "把这个工作区下载成 JSON")}
            </a>
          </p>
          <form action={deleteWorkspace} className="space-y-2 border-t border-border pt-4">
            <p className="text-sm">{tr(locale, `Type “${current.name}” to delete the workspace and its content, usage, and recommendations.`, `输入「${current.name}」以删除工作区，以及里面的内容、使用记录和建议。`)}</p>
            <input name="confirm" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
            <SubmitButton variant="destructive">{tr(locale, "Delete workspace", "删除工作区")}</SubmitButton>
          </form>
        </section>
      ) : null}
      <form action={deleteAccount} className="mt-8 space-y-2">
        <h2 className="text-xl">{tr(locale, "Delete the account", "删除账号")}</h2>
        <p className="text-sm text-muted-foreground">{tr(locale, `Type ${user.email} to delete the login and any workspace you are the only member of.`, `输入 ${user.email}，删除登录账号，以及只有你一个人的工作区。`)}</p>
        <input name="confirm" className="h-10 w-full max-w-md rounded-lg border border-input bg-card px-3 text-sm" />
        <div>
          <SubmitButton variant="destructive">{tr(locale, "Delete account", "删除账号")}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
