export type Actor = {
  id: string;
  platformRole: string;
};

export class TenantIsolationError extends Error {
  constructor(message = "You do not have access to this workspace.") {
    super(message);
    this.name = "TenantIsolationError";
  }
}

export function canAccessWorkspace(
  actor: Actor,
  workspaceId: string,
  membershipWorkspaceIds: readonly string[],
) {
  if (actor.platformRole === "admin") return true;
  return membershipWorkspaceIds.includes(workspaceId);
}

export function assertCanAccessWorkspace(
  actor: Actor,
  workspaceId: string,
  membershipWorkspaceIds: readonly string[],
) {
  if (!canAccessWorkspace(actor, workspaceId, membershipWorkspaceIds)) {
    throw new TenantIsolationError();
  }
}

export class ApprovalForbiddenError extends Error {
  constructor(message = "Only a member of this workspace can approve. Adsmart staff cannot approve on a client's behalf.") {
    super(message);
    this.name = "ApprovalForbiddenError";
  }
}

export function assertClientCanApprove(
  actor: Actor,
  workspaceId: string,
  membershipWorkspaceIds: readonly string[],
) {
  if (actor.platformRole === "admin") {
    throw new ApprovalForbiddenError("Adsmart staff cannot approve a client's content.");
  }
  if (!membershipWorkspaceIds.includes(workspaceId)) {
    throw new ApprovalForbiddenError("Only a member of this workspace can approve.");
  }
}

export function assertAdmin(actor: Actor) {
  if (actor.platformRole !== "admin") {
    throw new TenantIsolationError("This view is for Adsmart staff.");
  }
}

export function canSeeRecommendation(
  actor: Actor,
  recommendation: { workspaceId: string; status: string },
  membershipWorkspaceIds: readonly string[],
) {
  if (!canAccessWorkspace(actor, recommendation.workspaceId, membershipWorkspaceIds)) return false;
  if (actor.platformRole === "admin") return true;
  return recommendation.status === "sent";
}

export function recommendationCopy(
  recommendation: {
    primaryLocale: string;
    title: string;
    body: string;
    titleAlt: string;
    bodyAlt: string;
    editedTitle: string;
    editedBody: string;
    editedTitleAlt: string;
    editedBodyAlt: string;
  },
  locale: "en" | "zh",
) {
  const primary = recommendation.primaryLocale === "en" ? "en" : "zh";
  if (locale === primary) {
    return {
      title: recommendation.editedTitle || recommendation.title,
      body: recommendation.editedBody || recommendation.body,
    };
  }
  return {
    title:
      recommendation.editedTitleAlt ||
      recommendation.titleAlt ||
      recommendation.editedTitle ||
      recommendation.title,
    body:
      recommendation.editedBodyAlt ||
      recommendation.bodyAlt ||
      recommendation.editedBody ||
      recommendation.body,
  };
}
