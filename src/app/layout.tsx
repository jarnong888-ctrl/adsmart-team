import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
// Noto Sans SC is self-hosted from npm (split by unicode-range, so a page only
// downloads the characters it uses). No build-time call to Google Fonts.
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adsmart Team",
  description: "An AI marketing team for Malaysian SMEs. Nothing is posted without a person approving it.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await cookies()).get("adsmart_locale")?.value === "zh" ? "zh-CN" : "en";
  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" theme="light" />
      </body>
    </html>
  );
}
