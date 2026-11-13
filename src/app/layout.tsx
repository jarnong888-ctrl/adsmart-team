import type { Metadata } from "next";
import { Inter, Noto_Sans_SC } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const noto = Noto_Sans_SC({
  weight: ["600", "700", "800"],
  variable: "--font-noto",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Adsmart Team",
  description: "An AI marketing team for Malaysian SMEs. Nothing is posted without a person approving it.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await cookies()).get("adsmart_locale")?.value === "zh" ? "zh-CN" : "en";
  return (
    <html lang={locale} className={`${inter.variable} ${noto.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" theme="light" />
      </body>
    </html>
  );
}
