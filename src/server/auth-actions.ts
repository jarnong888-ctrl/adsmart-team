"use server";

import { compareSync, hashSync } from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { planByCode } from "@/lib/plans";
import { prisma } from "@/lib/db";
import { newToken, hashToken, slugify } from "@/lib/tokens";
import { ensureWallet } from "@/server/credits";
import { go, safeNext } from "@/server/nav";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

async function startSession(userId: string) {
  const token = newToken();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  const jar = await cookies();
  jar.set("adsmart_session", token, cookieBase);
  const first = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { workspace: { name: "asc" } },
  });
  if (first) jar.set("adsmart_workspace", first.workspaceId, cookieBase);
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !compareSync(password, user.passwordHash)) {
    go("/login", { error: "login" });
  }
  await startSession(user.id);
  if (user.platformRole === "admin" && next === "/studio") go("/admin");
  go(next);
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get("adsmart_session")?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete("adsmart_session");
  jar.delete("adsmart_workspace");
  go("/");
}

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  password: z.string().min(8).max(100),
  workspace: z.string().trim().min(2).max(80),
});

export async function signup(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
    workspace: formData.get("workspace"),
  });
  if (!parsed.success) go("/signup", { error: "invalid" });
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) go("/signup", { error: "taken" });
  const consent = formData.get("consent") === "on";
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: hashSync(parsed.data.password, 10),
      analyticsConsent: consent,
      locale: "en",
    },
  });
  const workspace = await prisma.workspace.create({
    data: {
      name: parsed.data.workspace,
      slug: slugify(parsed.data.workspace),
      planCode: "starter",
      analyticsConsent: consent,
      primaryLanguage: "zh",
      postingCapacity: planByCode("starter").videosPerWeek,
      members: { create: { userId: user.id, role: "owner" } },
    },
  });
  await ensureWallet(workspace.id);
  await startSession(user.id);
  const jar = await cookies();
  jar.set("adsmart_workspace", workspace.id, cookieBase);
  go("/studio/workspace", { notice: "saved" });
}

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale") === "zh" ? "zh" : "en";
  const jar = await cookies();
  jar.set("adsmart_locale", locale, { ...cookieBase, httpOnly: false });
  const token = jar.get("adsmart_session")?.value;
  if (token) {
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
    if (session) {
      await prisma.user.update({ where: { id: session.userId }, data: { locale } });
    }
  }
  const next = safeNext(formData.get("next"), "/");
  go(next);
}

export async function switchWorkspace(formData: FormData) {
  const { requireUser, memberIdsFor } = await import("@/server/guard");
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const ids = await memberIdsFor(user.id);
  if (user.platformRole !== "admin" && !ids.includes(workspaceId)) {
    go("/studio", { error: "forbidden" });
  }
  const jar = await cookies();
  jar.set("adsmart_workspace", workspaceId, cookieBase);
  go("/studio");
}
