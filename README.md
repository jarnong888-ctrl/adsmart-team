# Adsmart Team

An AI marketing team for Malaysian SMEs. Adsmart sells it to business owners. The demo workspace is Jarno Ng’s own case: Mandarin short video for TikTok `@jarnong`, from 78 followers toward 10,000, with the class ladder and the Adsmart plugin in the offers.

Nothing is published without a person approving it. Plans wait. Queued posts wait again.

## Run it

```bash
npm install && npm run demo
```

That creates `.env` from `.env.example` if you don’t have one, creates the SQLite database, seeds the demo, and starts the app at [http://127.0.0.1:43123](http://127.0.0.1:43123).

| Login | Password | What you see |
| --- | --- | --- |
| `demo@adsmart.my` | `studio-demo` | Jarno’s workspace, mid-pipeline |
| `owner@kedairasa.example` | `studio-demo` | A quiet bakery, churn risk, nothing sent yet |
| `hello@batikandco.example` | `studio-demo` | A retail store hitting the Starter cap |
| `admin@adsmart.my` | `studio-admin` | Staff view across every workspace |

Mock mode is the default. The header says **Mock AI**. You can generate a week, approve it, write scripts, repurpose, brief, queue, and approve a post with no API key. Approval schedules the post. The stub publisher sends it only when that time arrives.

Other commands:

```bash
npm test          # pipeline, approval gate, recommendation rules, tenant isolation
npm run setup     # database only
npm run dev       # app only, port 43123
```

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file. Local default `file:./dev.db`. |
| `LLM_MODE` | `mock` (default) or `live`. |
| `OPENAI_API_KEY` or `LLM_API_KEY` | Required for live mode. |
| `OPENAI_BASE_URL` | OpenAI-compatible chat endpoint. Default `https://api.openai.com/v1`. |
| `OPENAI_MODEL` | Default `gpt-4o-mini`. |
| `LLM_PROVIDER` | Label stored with live responses. Default `openai`. |

If `LLM_MODE=live` and no key is set, the app stays on mock and says so. Live mode asks for JSON and refuses a response that doesn’t match the expected shape. It does not silently invent citations.

## What the team does

1. **Content strategist** builds a week from the workspace: capacity, mix (mindset / practical / trends), a CTA, and a soft-sell ratio. The week stays `pending_approval` until a member of that workspace approves it. Adsmart staff cannot approve on a client's behalf. The approver's user id and the time are stored on the plan.
2. **Scriptwriter** writes a 30-second, timecoded script in Mandarin, English, or Malay, with visual and subtitle cues, a comment-keyword CTA, sources, and flags: `DEMO`, `NEEDS_FACT_CHECK`, `COMMERCIAL_DISCLOSURE`. No script is written until that workspace’s client has approved the whole week. A client can still approve a script that has an open `NEEDS_FACT_CHECK` or `【待核实】` marker, but only after ticking an acknowledgement. That acknowledgement is stored on the script and written to the activity log. The flag stays.
3. **Repurposer** turns the script into an Instagram caption, a carousel outline, a Facebook post, and size notes.
4. **Video editor** writes an edit brief for 9:16, 1:1, 4:5, and 16:9. A file input only stores the filename. Bytes are not uploaded.
5. **Social** queues posts. Each post is `pending_approval`. Only a member of that workspace can approve it; staff and users from other workspaces are rejected. One approval covers every platform version of the same video (TikTok, Instagram, Facebook). The approver's user id and the time are stored on each of those posts, and they are scheduled at the planned time. There is no separate Publish button. A `Publisher` stub sends a post only when it is `approved` and `scheduledFor` has arrived. Pending and future posts never reach the stub.
6. **Analytics** takes manual follower and view counts and shows the daily pace to the follower goal.
7. **Analyst** keeps a watchlist. There is no engage action.
8. **CMO** summarises the last 48 hours, what is waiting, goal pace, and recommendations that staff have already sent.

A week’s scripts export to CSV or XLSX from the strategist page.

## Usage, health, and recommendations

Each workspace can consent to usage events: content generated, approvals, queues, platforms, snapshots, and which desks were opened. Without consent, events are not stored, health is `no_consent`, and the recommender stays quiet.

Staff (`platformRole = admin`) see every workspace: plan, videos against the cap, follower progress, days since the last event, and signals such as `content_limit`, `behind_goal`, `churn_risk`, and unused desks. Clients only see their own workspace. A recommendation is a draft until a staff member sends it. Clients never see drafts.

The recommender is rules first:

- near or at the weekly video cap → upgrade
- a higher plan barely used for 30 days → downgrade
- quiet for 10+ days → restart the cadence, and offer the RM29.90 class if they don’t already sell it
- follower pace under 60% of what the goal needs → say so, with the numbers
- one pillar well ahead on recorded views → shift the mix
- retail / Shopify language, and no plugin in the offers → the Adsmart plugin
- at the cap on Growth or Studio, and no consulting in the offers → a project

“Polish with AI” rewrites the words through the same LLM module. The code, the category, and the rationale stay. Mock mode appends a one-line coach note.

Billing is pay-as-you-go credits, not the old RM199 / RM599 / RM1,490 subscriptions. Placeholder packs: Free RM0 with a monthly starter allowance, Intermediate RM49 for 200 credits, Pro RM149 for 800 credits. Admins can change the prices, the credit amounts, and the cost of each AI action. A mock payment provider records the purchase and adds credits. Stripe with FPX, Billplz, and ToyyibPay are named providers and refuse to charge until a gateway is actually connected. The classes and the plugin are still separate offers. A production cap (how many videos a week the desk plans) is separate from the credit balance.

## Malaysia PDPA

This is a product note, not legal advice. Adsmart Sdn Bhd should confirm it with counsel before real clients are onboarded.

- **Purpose.** Usage events exist to run the workspace, show health to staff, and recommend a next step. They are not a training set for a model in this MVP, and the app does not send them to a model unless someone presses “Polish with AI”, which sends the recommendation text, not the raw event log.
- **Consent.** Signup and Privacy have an unchecked-by-default choice for usage analytics. Content (plans, scripts, briefs) is stored either way, because that is the service. Withdrawing consent stops new usage events. It does not delete old ones.
- **Access and correction.** A member can download the workspace as JSON from Privacy. Staff can open a workspace they support; that access is role-gated.
- **Deletion.** A member can delete a workspace (type its name) or the account (type the email). Deletion cascades plans, scripts, usage events, and recommendations.
- **Retention.** Not implemented. A real deployment needs a stated retention period and a way to honour an access or correction request from someone who is not the logged-in owner.
- **Tenancy.** Queries for a client are scoped to workspaces they belong to. Recommendations with status other than `sent` are filtered out for clients. Tests cover this against the database.

## Architecture

```
src/lib/team.ts            strategist, script, repurpose, brief (deterministic)
src/lib/llm.ts             mock or OpenAI-compatible chat, one module
src/lib/pipeline.ts        status order and the approval errors
src/lib/publishers.ts      Publisher interface, Buffer and TikTok stubs, gate
src/lib/payments.ts        PaymentProvider, mock checkout, named Malaysian gateways
src/lib/token-estimate.ts  prompt and completion tokens from the live prompts
src/server/credits.ts      wallet, spend, allowance, purchases, admin adjustment
src/lib/recommendations.ts rules, health, when to refresh a draft
src/lib/usage.ts           profile from events, snapshots, pillar views
src/server/*               session, mutations, tenant queries
prisma/schema.prisma       SQLite. Swap DATABASE_URL for Postgres later.
```

Auth is an httpOnly session cookie. The token is stored as a SHA-256 hash. Passwords are bcrypt hashes. `src/proxy.ts` only checks that the cookie exists; the layout checks the session.

## Tests

`npm test` covers:

- mix math, soft-sell placement, script flags
- plan approval before scripts, fact-check acknowledgement, one approval for every platform of a video, and stub publish only at the planned time
- the publish gate: pending and rejected posts do not call the publisher
- approval authority: a workspace member can approve; staff cannot, even if they can see the workspace; a user from another workspace cannot
- follower pace from 78 toward 10,000
- recommendation rules, including “no consent”
- tenant isolation: a client cannot read another workspace, cannot see drafts, and staff can

## Next

- Replace the publisher stubs with Buffer and TikTok, still behind `publishThroughGate`.
- Confirm the draft prices and whether the weekly cap is a hard stop. Today you can generate past the cap, and the recommender treats that as an upgrade signal.
- Billing. There is no payment provider.
- A real fact-check step that blocks filming, not only a flag.
- PDPA: name the data controller, set retention, and record staff access.
- Postgres, and more than one person per workspace with an approver role.
- Bahasa Malaysia in the UI. Scripts already support it. The chrome is English and 中文.
