import { redirect } from "next/navigation";

export function go(path: string, code?: { error?: string; notice?: string }): never {
  const params = new URLSearchParams();
  if (code?.error) params.set("error", code.error);
  if (code?.notice) params.set("notice", code.notice);
  const query = params.toString();
  redirect(query ? `${path}?${query}` : path);
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
