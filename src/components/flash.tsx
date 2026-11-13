import Link from "next/link";
import { NoticeToast } from "@/components/notice-toast";
import { flashMessage, tr, type Locale } from "@/lib/i18n";

export function Flash({
  locale,
  error,
  notice,
}: {
  locale: Locale;
  error?: string;
  notice?: string;
}) {
  const message = flashMessage(locale, error || notice);
  const kind = error ? "error" : notice ? "success" : null;
  return (
    <>
      <NoticeToast message={message} kind={kind} />
      {message ? (
        <p
          role={error ? "alert" : "status"}
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-foreground"}`}
        >
          {message}
          {error === "credits" ? (
            <>
              {" "}
              <Link href="/studio/credits" className="underline">{tr(locale, "Reload credits", "充值")}</Link>
            </>
          ) : null}
        </p>
      ) : null}
    </>
  );
}
