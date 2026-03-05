export const mockData = {
  confidence: 92,
  summary: [
    "The team agreed to shift the product launch from Q2 to early Q3 to allow additional QA cycles.",
    "Engineering will prioritize the new authentication module over the dashboard redesign.",
    "Marketing presented a revised go-to-market strategy focusing on enterprise clients first.",
    "The data pipeline migration to the new cloud provider is 78% complete and on track.",
    "Customer success flagged a 15% increase in churn among mid-market accounts.",
    "A cross-functional tiger team will be formed to address onboarding drop-off rates.",
    "Legal confirmed the updated Terms of Service are ready for review by end of week.",
  ],
  decisions: [
    {
      title: "Product launch moved to Q3",
      detail: "Unanimous decision to delay launch by 6 weeks to ensure stability and complete penetration testing.",
    },
    {
      title: "Authentication module prioritized",
      detail: "Engineering will allocate 3 additional sprints to the auth module before resuming dashboard work.",
    },
    {
      title: "Enterprise-first GTM strategy approved",
      detail: "Marketing will focus initial outreach on Fortune 500 accounts with a tailored demo flow.",
    },
    {
      title: "Tiger team formation",
      detail: "A 5-person cross-functional team will investigate and resolve onboarding friction within 30 days.",
    },
  ],
  actionItems: [
    {
      task: "Draft revised launch timeline",
      owner: "Sarah Chen",
      dueDate: "2026-03-12",
      evidence: '"We need a clear week-by-week plan before the board meeting on the 15th." — VP Product',
    },
    {
      task: "Complete auth module security audit",
      owner: "Marcus Johnson",
      dueDate: "2026-03-20",
      evidence: '"Security sign-off is a hard blocker for launch." — CTO',
    },
    {
      task: "Prepare enterprise demo environment",
      owner: "Priya Patel",
      dueDate: "2026-03-18",
      evidence: '"We need a sandbox that mirrors production for the Acme Corp demo." — Sales Lead',
    },
    {
      task: "Analyze mid-market churn cohort",
      owner: "David Kim",
      dueDate: "2026-03-10",
      evidence: '"I want to understand if this is a pricing issue or a product-fit issue." — CEO',
    },
    {
      task: "Recruit tiger team members",
      owner: "Lisa Wong",
      dueDate: "2026-03-08",
      evidence: '"We should pull from engineering, design, and CS for the best perspective." — COO',
    },
  ],
  risks: [
    {
      title: "QA bandwidth constraint",
      detail: "Current QA team is at capacity. Delay risk if additional contractors aren't onboarded by next week.",
    },
    {
      title: "Cloud migration dependency",
      detail: "The auth module relies on the new cloud infra. Any migration delays cascade into the launch timeline.",
    },
    {
      title: "Competitor launch rumored for April",
      detail: "Intelligence suggests CompetitorX may launch a similar feature set, reducing our first-mover advantage.",
    },
    {
      title: "Open question: Pricing model for enterprise tier",
      detail: "No consensus was reached on per-seat vs. usage-based pricing. Needs follow-up session.",
    },
  ],
};
