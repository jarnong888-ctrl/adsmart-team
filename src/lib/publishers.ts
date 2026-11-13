import { authorizePublish } from "@/lib/pipeline";

export type PublishJob = {
  workspaceId: string;
  entryId: string;
  platform: string;
  caption: string;
  scheduledFor: string;
};

export type PublishReceipt = {
  publisher: "buffer" | "tiktok";
  externalId: string;
  mode: "stub";
  detail: string;
};

export interface Publisher {
  key: "buffer" | "tiktok";
  publish(job: PublishJob): Promise<PublishReceipt>;
}

class StubPublisher implements Publisher {
  constructor(readonly key: "buffer" | "tiktok") {}

  async publish(job: PublishJob): Promise<PublishReceipt> {
    return {
      publisher: this.key,
      externalId: `${this.key}_stub_${job.entryId.slice(0, 8)}`,
      mode: "stub",
      detail: `${this.key} accepted a stub publish for ${job.platform}. No live network call was made.`,
    };
  }
}

export const bufferPublisher: Publisher = new StubPublisher("buffer");
export const tiktokPublisher: Publisher = new StubPublisher("tiktok");

export function publisherForPlatform(platform: string): Publisher {
  if (platform === "tiktok") return tiktokPublisher;
  return bufferPublisher;
}

export async function publishThroughGate(
  entry: { status: string },
  job: PublishJob,
  publisher: Publisher = publisherForPlatform(job.platform),
): Promise<PublishReceipt> {
  authorizePublish(entry);
  return publisher.publish(job);
}
