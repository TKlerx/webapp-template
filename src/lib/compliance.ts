import { prisma } from "@/lib/db";
import { ReviewStatus } from "../../generated/prisma/enums";

type StatusFilter = "approved" | "all";

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function emptyStatusCounts() {
  return {
    pending: 0,
    approved: 0,
    flagged: 0,
    rejected: 0,
  };
}

function addStatusCount(
  counts: ReturnType<typeof emptyStatusCounts>,
  status: ReviewStatus,
) {
  switch (status) {
    case ReviewStatus.PENDING_REVIEW:
      counts.pending += 1;
      break;
    case ReviewStatus.APPROVED:
      counts.approved += 1;
      break;
    case ReviewStatus.FLAGGED:
      counts.flagged += 1;
      break;
    case ReviewStatus.REJECTED:
      counts.rejected += 1;
      break;
  }
}

export async function getCountrySummaries(budgetYearId: string, statusFilter: StatusFilter = "all") {
  const countryBudgets = await prisma.countryBudget.findMany({
    where: { budgetYearId },
    include: {
      country: true,
      budgetItems: {
        include: {
          receipts: true,
        },
      },
    },
    orderBy: {
      country: {
        name: "asc",
      },
    },
  });

  return countryBudgets.map((countryBudget) => {
    const statusCounts = emptyStatusCounts();
    let approvedSpend = 0;
    let totalSpend = 0;

    for (const item of countryBudget.budgetItems) {
      for (const receipt of item.receipts) {
        addStatusCount(statusCounts, receipt.reviewStatus);
        totalSpend += toNumber(receipt.amount);
        if (receipt.reviewStatus === ReviewStatus.APPROVED) {
          approvedSpend += toNumber(receipt.amount);
        }
      }
    }

    const actualSpend = statusFilter === "approved" ? approvedSpend : totalSpend;
    const totalBudget = toNumber(countryBudget.totalAmount);

    return {
      countryBudgetId: countryBudget.id,
      countryId: countryBudget.countryId,
      countryName: countryBudget.country.name,
      totalBudget,
      currency: countryBudget.currency,
      approvedSpend,
      totalSpend,
      percentUsed: totalBudget === 0 ? 0 : Math.round((actualSpend / totalBudget) * 100),
      statusCounts,
    };
  });
}

type BudgetNode = {
  id: string;
  name: string;
  parentId: string | null;
  plannedAmount: number;
  actualAmount: number;
  approvedAmount: number;
  statusCounts: ReturnType<typeof emptyStatusCounts>;
  overBudget: boolean;
  receipts: Array<{
    id: string;
    amount: number;
    currency: string;
    date: Date;
    description: string;
    reviewStatus: ReviewStatus;
  }>;
  children: BudgetNode[];
};

export async function getBudgetItemBreakdown(
  countryBudgetId: string,
  statusFilter: StatusFilter = "all",
) {
  const items = await prisma.budgetItem.findMany({
    where: { countryBudgetId },
    include: {
      receipts: {
        orderBy: { date: "desc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const nodes = new Map<string, BudgetNode>();
  for (const item of items) {
    const statusCounts = emptyStatusCounts();
    let actualAmount = 0;
    let approvedAmount = 0;
    const receipts = item.receipts.map((receipt) => {
      addStatusCount(statusCounts, receipt.reviewStatus);
      actualAmount += toNumber(receipt.amount);
      if (receipt.reviewStatus === ReviewStatus.APPROVED) {
        approvedAmount += toNumber(receipt.amount);
      }

      return {
        id: receipt.id,
        amount: toNumber(receipt.amount),
        currency: receipt.currency,
        date: receipt.date,
        description: receipt.description,
        reviewStatus: receipt.reviewStatus,
      };
    });

    nodes.set(item.id, {
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      plannedAmount: toNumber(item.plannedAmount),
      actualAmount,
      approvedAmount,
      statusCounts,
      overBudget: false,
      receipts,
      children: [],
    });
  }

  const roots: BudgetNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function finalize(node: BudgetNode): BudgetNode {
    for (const child of node.children) {
      const finalizedChild = finalize(child);
      node.actualAmount += finalizedChild.actualAmount;
      node.approvedAmount += finalizedChild.approvedAmount;
      node.statusCounts.pending += finalizedChild.statusCounts.pending;
      node.statusCounts.approved += finalizedChild.statusCounts.approved;
      node.statusCounts.flagged += finalizedChild.statusCounts.flagged;
      node.statusCounts.rejected += finalizedChild.statusCounts.rejected;
    }

    const compareAmount = statusFilter === "approved" ? node.approvedAmount : node.actualAmount;
    node.overBudget = compareAmount > node.plannedAmount;
    return node;
  }

  return roots.map(finalize);
}
