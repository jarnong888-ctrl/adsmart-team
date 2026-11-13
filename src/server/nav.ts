import { redirect } from "next/navigation";

export function go(path: string, code?: { error?: string; notice?: string }): never {
  const params = new URLSearchParams();
  if (code?.error) params.set("error", code.error);
  if (code?.notice) params.set("notice", code.notice);
  const query = params.toString();
  redirect(query ? `${path}?${query}` : path);
}

/**
 * Redirect to the page the form came from when it is a known studio list
 * (Scripts), otherwise to the fallback. Only same-app paths are accepted.
 */
export function goBack(formData: FormData, fallback: string, code?: { error?: string; notice?: string }): never {
  const raw = String(formData.get("returnTo") ?? "");
  if (!raw.startsWith("/studio/scripts")) go(fallback, code);
  const url = new URL(raw, "http://local");
  if (url.pathname !== "/studio/scripts") go(fallback, code);
  url.searchParams.delete("error");
  url.searchParams.delete("notice");
  if (code?.error) url.searchParams.set("error", code.error);
  if (code?.notice) url.searchParams.set("notice", code.notice);
  const query = url.searchParams.toString();
  redirect(query ? `${url.pathname}?${query}` : url.pathname);
}

export function rethrowRedirect(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }
}

export function safeNext(value: FormDataEntryValue | null, fallback = "/studio") {
  if (typeof value !== "string") return fallback;
  if (value.startsWith("/studio") || value.startsWith("/admin")) return value;
  return fallback;
}
