export type PlatformService = {
  id: "buffer" | "canva";
  nameEn: string;
  nameZh: string;
  useEn: string;
  useZh: string;
  status: "mock" | "configured" | "missing";
};

export function platformServices(env: Partial<NodeJS.ProcessEnv> = process.env): PlatformService[] {
  const forceMock = (env.INTEGRATIONS_MODE || "mock") !== "live";
  const statusFor = (ready: boolean): PlatformService["status"] => (forceMock ? "mock" : ready ? "configured" : "missing");
  return [
    {
      id: "buffer",
      nameEn: "Buffer",
      nameZh: "Buffer",
      useEn: "Adsmart’s scheduler. It posts to each client’s connected social profiles after they approve. Clients do not connect Buffer.",
      useZh: "Adsmart 的排程。客户批准之后，发到他们自己连接的社交账号。客户不连接 Buffer。",
      status: statusFor(Boolean(env.BUFFER_API_KEY)),
    },
    {
      id: "canva",
      nameEn: "Canva",
      nameZh: "Canva",
      useEn: "Adsmart’s design account for edit briefs. Clients do not connect Canva.",
      useZh: "Adsmart 自己的设计账号，用来做剪辑单。客户不连接 Canva。",
      status: statusFor(Boolean(env.CANVA_CLIENT_ID && env.CANVA_CLIENT_SECRET)),
    },
  ];
}
