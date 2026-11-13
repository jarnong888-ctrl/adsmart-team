export type Locale = "en" | "zh";

export function tr(locale: Locale, en: string, zh: string) {
  return locale === "zh" ? zh : en;
}

export function statusLabel(locale: Locale, status: string) {
  const labels: Record<string, [string, string]> = {
    planned: ["Planned", "已排期"],
    pending_approval: ["Waiting for approval", "待批准"],
    changes_requested: ["Changes requested", "已退回修改"],
    approved: ["Approved", "已批准"],
    unscheduled: ["Unscheduled", "已取消排期"],
    plan_approved: ["To write", "待写脚本"],
    script_ready: ["Script ready", "脚本已好"],
    repurposed: ["Repurposed", "已改写"],
    brief_ready: ["Edit brief ready", "剪辑单已好"],
    queued: ["Queued", "已排队"],
    schedule_approved: ["Approved to post", "已批准发布"],
    published: ["Published", "已发布"],
    rejected: ["Rejected", "已拒绝"],
    draft: ["Draft", "草稿"],
    sent: ["Sent", "已发送"],
    dismissed: ["Dismissed", "已搁置"],
  };
  const pair = labels[status];
  if (!pair) return status;
  return tr(locale, pair[0], pair[1]);
}

export function pillarLabel(locale: Locale, pillar: string) {
  if (pillar === "mindset") return tr(locale, "Mindset", "心态");
  if (pillar === "practical") return tr(locale, "Practical", "实操");
  if (pillar === "trends") return tr(locale, "Trends", "趋势");
  return pillar;
}

export function healthLabel(locale: Locale, health: string) {
  const labels: Record<string, [string, string]> = {
    healthy: ["Healthy", "健康"],
    low_engagement: ["Low engagement", "参与度低"],
    churn_risk: ["Churn risk", "流失风险"],
    expansion: ["Expansion", "可增购"],
    no_consent: ["No analytics consent", "未同意分析"],
  };
  const pair = labels[health];
  return pair ? tr(locale, pair[0], pair[1]) : health;
}

export function flashMessage(locale: Locale, code: string | undefined) {
  if (!code) return null;
  const messages: Record<string, [string, string]> = {
    approved: ["Approved. Scripts can be written now.", "已批准。现在可以写脚本。"],
    changes: ["Sent back for changes. Nothing was queued.", "已退回修改。没有进入排期。"],
    generated: ["Week generated. It is waiting for your approval.", "本周已生成，正在等你批准。"],
    scripts: ["Scripts written.", "脚本已写好。"],
    repurposed: ["Repurpose pack ready.", "改写包已好。"],
    brief: ["Edit brief ready.", "剪辑单已好。"],
    queued: ["Queued. Each post still needs its own approval.", "已排队。每一条仍需要单独批准。"],
    post_approved: ["Approved and scheduled. It goes out at the planned time. You can unschedule it before then.", "已批准并排期。它会按计划时间发出。发出前可以取消排期。"],
    unscheduled: ["Unscheduled. It will not go out. You can approve and schedule it again.", "已取消排期。这条不会发出。之后可以重新批准并排期。"],
    post_rejected: ["Post rejected. It will not be published.", "已拒绝。这条不会发布。"],
    published: ["Stub publisher accepted the approved post. No live network call was made.", "模拟发布已接受这条已批准的内容。没有真实网络请求。"],
    approval_required: ["Blocked. This post is not approved, so nothing was published.", "已拦住。这条还没批准，所以没有发布。"],
    plan_not_approved: ["Approve the whole week before any script is written.", "先批准整周计划，才能写脚本。"],
    fact_check_ack: ["Tick the box to confirm you have seen the open fact-check.", "请勾选，确认你看到了待核实标记。"],
    script_approved: ["Script approved. Any open fact-check stays on the script.", "脚本已批准。未核实的标记仍留在脚本上。"],
    not_approver: [
      "Only a member of this workspace can approve. Adsmart staff cannot approve on a client's behalf.",
      "只有这个工作区的成员可以批准。Adsmart 员工不能代客户批准。",
    ],
    pipeline: ["That step is out of order.", "这一步的顺序不对。"],
    week_exists: ["A plan already exists for that week.", "这一周已经有计划了。"],
    mix: ["Mindset, practical, and trends must add up to 100.", "心态、实操、趋势必须加起来等于 100。"],
    saved: ["Saved.", "已保存。"],
    forbidden: ["You don't have access to that workspace.", "你不能查看这个工作区。"],
    workspace_limit: ["This plan's workspace limit has been reached.", "已达到这个方案的工作区上限。"],
    deleted: ["Deleted.", "已删除。"],
    consent: ["Consent updated. New usage events follow this choice.", "同意状态已更新。之后的使用记录按这个选择处理。"],
    sent: ["Sent to the client.", "已发给客户。"],
    dismissed: ["Dismissed. The client will not see it.", "已搁置。客户不会看到。"],
    polished: ["Copy polished. The rule and the numbers were kept.", "文案已润色。规则和数字都还在。"],
    refreshed: ["Recommendations refreshed from the rules.", "已按规则刷新建议。"],
    login: ["Email or password does not match.", "邮箱或密码不对。"],
    taken: ["That email is already registered.", "这个邮箱已经注册过。"],
    invalid: ["Check the form and try again.", "请检查表单后再试。"],
    confirm: ["Type the workspace name exactly to delete it.", "删除前请把工作区名称原样输入。"],
    missing: ["That record is no longer there.", "这条记录已经不在了。"],
    file: ["Filename saved on the brief. The video file was not uploaded.", "文件名已写进剪辑单。视频本身没有上传。"],
    account_deleted: ["Account deleted.", "账号已删除。"],
    llm: ["The model did not return a usable result. Mock mode is still available if you clear the API key.", "模型没有返回可用结果。清掉 API key 后仍可用模拟模式。"],
    credits: ["Not enough credits. This action did not run. Reload credits to continue.", "点数不够，这次没有生成。请先充值。"],
    purchased: ["Credits added. The payment was simulated. Nothing was charged.", "点数已加上。这次是模拟付款，没有真实扣款。"],
    payment: ["The payment did not complete. No credits were added and nothing was charged.", "付款没有完成。点数没加上，也没有扣款。"],
    adjusted: ["Credits adjusted. The note is in the audit log.", "点数已调整。原因写在审计记录里。"],
    costs_saved: ["Credit settings saved.", "点数设置已保存。"],
    connected: ["Connected. Tokens are stored encrypted.", "已连接。令牌已加密保存。"],
    disconnected: ["Disconnected. Saved tokens were removed.", "已断开。保存的令牌已删除。"],
    integration: ["That connection did not finish. Nothing was stored.", "连接没有完成。没有保存任何令牌。"],
    saved_drive: ["Saved to the connected Drive folder (mock). No file left this server.", "已记到已连接的 Drive 文件夹（模拟）。文件没有离开这台服务器。"],
  };
  const pair = messages[code];
  return pair ? tr(locale, pair[0], pair[1]) : code;
}

export function activityLine(locale: Locale, code: string, detail: string) {
  const detailText = detail ? ` · ${detail}` : "";
  const lines: Record<string, [string, string]> = {
    plan_generated: ["Content strategist drafted a week", "内容策略起草了一周"],
    plan_approved: ["Client approved the week", "客户批准了这一周"],
    plan_changes_requested: ["Client asked for changes", "客户要求修改"],
    script_written: ["Scriptwriter wrote a script", "编剧写了一条脚本"],
    repurposed: ["Repurposer packed the other formats", "改写做成了其他格式"],
    brief_ready: ["Video editor wrote a brief", "剪辑写了剪辑单"],
    raw_attached: ["Editor noted a raw filename", "剪辑记下了素材文件名"],
    post_queued: ["Social queued a post", "社媒把一条放进队列"],
    post_approved: ["Client approved and scheduled a post", "客户批准并排期"],
    post_unscheduled: ["Client unscheduled a post before its send time", "客户在发出前取消了排期"],
    post_rejected: ["Client rejected a post", "客户拒绝了一条发布"],
    post_published: ["An approved post reached its planned time and the stub publisher sent it", "已批准的帖子到了计划时间，模拟发布已发出"],
    fact_check_acknowledged: ["Client approved a script and acknowledged an open fact-check", "客户批准了脚本，并确认看到了待核实标记"],
    script_approved: ["Client approved the script", "客户批准了脚本"],
    analytics_saved: ["Analytics recorded a snapshot", "数据记下了一笔手动数据"],
    competitor_saved: ["Analyst updated the watchlist", "分析更新了观察名单"],
    recommendation_sent: ["CMO sent a recommendation", "协调人发出了一条建议"],
    credits_purchased: ["Client reloaded credits through the mock payment provider", "客户通过模拟付款充了点数"],
    credit_adjusted: ["Staff adjusted this workspace's credits", "同事调整了这个工作区的点数"],
    saved_to_drive: ["A deliverable was marked for the connected Drive folder", "一份成片已记到已连接的 Drive 文件夹"],
  };
  const pair = lines[code] ?? [code, code];
  return `${tr(locale, pair[0], pair[1])}${detailText}`;
}

export const ROLE_LABEL: Record<string, [string, string]> = {
  strategist: ["Content strategist", "内容策略"],
  scriptwriter: ["Scriptwriter", "编剧"],
  repurposer: ["Repurposer", "改写"],
  editor: ["Video editor", "剪辑"],
  social: ["Social media manager", "社媒"],
  analytics: ["Analytics", "数据"],
  analyst: ["Marketing analyst", "市场分析"],
  cmo: ["CMO", "协调人"],
  client: ["Client", "客户"],
};
