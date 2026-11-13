export type PaceStatus = "on_track" | "behind" | "far_behind" | "no_goal" | "complete";

export type PaceReport = {
  remaining: number;
  daysLeft: number;
  requiredDaily: number;
  actualDaily: number;
  neededDailyNow: number;
  ratio: number;
  status: PaceStatus;
};

export function paceReport(input: {
  baseline: number;
  latest: number;
  goal: number;
  horizonDays: number;
  elapsedDays: number;
}): PaceReport {
  const elapsed = Math.max(0, input.elapsedDays);
  const horizon = Math.max(0, input.horizonDays);
  const remaining = Math.max(0, input.goal - input.latest);
  const daysLeft = Math.max(0, horizon - elapsed);
  const requiredDaily = horizon > 0 ? (input.goal - input.baseline) / horizon : 0;
  const actualDaily = elapsed > 0 ? (input.latest - input.baseline) / elapsed : 0;
  const neededDailyNow = daysLeft > 0 ? remaining / daysLeft : remaining > 0 ? Number.POSITIVE_INFINITY : 0;
  if (input.goal <= input.baseline) {
    return {
      remaining,
      daysLeft,
      requiredDaily: 0,
      actualDaily,
      neededDailyNow,
      ratio: 1,
      status: "no_goal",
    };
  }
  if (remaining === 0) {
    return {
      remaining,
      daysLeft,
      requiredDaily,
      actualDaily,
      neededDailyNow,
      ratio: 1,
      status: "complete",
    };
  }
  const ratio = requiredDaily > 0 ? actualDaily / requiredDaily : 1;
  const status: PaceStatus = ratio >= 0.9 ? "on_track" : ratio >= 0.5 ? "behind" : "far_behind";
  return { remaining, daysLeft, requiredDaily, actualDaily, neededDailyNow, ratio, status };
}
