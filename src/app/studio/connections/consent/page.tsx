import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { isProviderId } from "@/lib/integrations/catalog";
import { INTEGRATION_CARDS } from "@/lib/integrations/catalog";
import { tr } from "@/lib/i18n";
import { allowMockConnection } from "@/server/integration-actions";
import { studioContext } from "@/server/context";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; state?: string }>;
}) {
  const { locale } = await studioContext();
  const sp = await searchParams;
  const provider = sp.provider || "";
  if (!isProviderId(provider) || !sp.state) notFound();
  const card = INTEGRATION_CARDS.find((item) => item.provider === provider && !item.comingSoon);
  const name = card ? (locale === "zh" ? card.nameZh : card.nameEn) : provider;
  return (
    <div className="mx-auto max-w-md">
      <p className="type-caption">{tr(locale, "Simulated consent", "模拟授权")}</p>
      <h1 className="type-h1 mt-1">{tr(locale, `Connect ${name}`, `连接 ${name}`)}</h1>
      <p className="type-body mt-2 text-[#3D5C54]">
        {tr(locale, "No real account is contacted. Allowing this stores a fake connected account for this workspace.", "不会联系真实账号。允许之后，只会给这个工作区存一个模拟的已连接账号。")}
      </p>
      <ul className="mt-4 space-y-2 rounded-[8px] border border-[#D5E3DD] bg-white p-4 text-[13px] leading-[1.55]">
        {INTEGRATION_CARDS.filter((item) => item.provider === provider && !item.comingSoon).map((item) => (
          <li key={item.id}>{locale === "zh" ? item.scopesZh : item.scopesEn}</li>
        ))}
      </ul>
      <form action={allowMockConnection} className="mt-4 flex gap-2">
        <input type="hidden" name="provider" value={provider} />
        <input type="hidden" name="state" value={sp.state} />
        <SubmitButton>{tr(locale, "Allow", "允许")}</SubmitButton>
        <Link href="/studio/connections" className="inline-flex h-10 items-center rounded-[6px] border border-[#C5D9D1] px-3 text-[13px]">{tr(locale, "Cancel", "取消")}</Link>
      </form>
    </div>
  );
}
