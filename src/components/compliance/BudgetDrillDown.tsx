import Link from "next/link";

type BudgetNode = {
  id: string;
  name: string;
  plannedAmount: number;
  actualAmount: number;
  approvedAmount: number;
  overBudget: boolean;
  statusCounts: {
    pending: number;
    approved: number;
    flagged: number;
    rejected: number;
  };
  children: BudgetNode[];
};

function BudgetNodeView({ node, depth = 0 }: { node: BudgetNode; depth?: number }) {
  return (
    <div className="space-y-3">
      <div
        className={`rounded-2xl border p-4 ${node.overBudget ? "border-red-300 bg-red-50 dark:border-red-700/60 dark:bg-red-900/10" : "border-black/10 bg-[var(--panel)] dark:border-white/10"}`}
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{node.name}</p>
            <p className="text-sm opacity-65">
              Planned {node.plannedAmount} | Actual {node.actualAmount} | Approved {node.approvedAmount}
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.16em] opacity-55">
            P {node.statusCounts.pending} | A {node.statusCounts.approved} | F {node.statusCounts.flagged} | R {node.statusCounts.rejected}
          </div>
        </div>
      </div>
      {node.children.map((child) => (
        <BudgetNodeView depth={depth + 1} key={child.id} node={child} />
      ))}
    </div>
  );
}

export function BudgetDrillDown({
  countryBudgetId,
  nodes,
}: {
  countryBudgetId: string;
  nodes: BudgetNode[];
}) {
  return (
    <div className="space-y-4">
      <Link className="underline" href="/compliance">
        Back to compliance
      </Link>
      {nodes.map((node) => (
        <BudgetNodeView key={`${countryBudgetId}-${node.id}`} node={node} />
      ))}
    </div>
  );
}
