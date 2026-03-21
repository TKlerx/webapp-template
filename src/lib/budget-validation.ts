import { prisma } from "@/lib/db";

type ValidateChildSumOptions = {
  excludeChildId?: string;
  nextChildAmount?: number | string;
};

export async function validateChildSum(parentId: string, options: ValidateChildSumOptions = {}) {
  const parent = await prisma.budgetItem.findUnique({
    where: { id: parentId },
    include: {
      children: {
        select: {
          id: true,
          plannedAmount: true,
        },
      },
    },
  });

  if (!parent) {
    throw new Error("PARENT_BUDGET_ITEM_NOT_FOUND");
  }

  const childSum = parent.children.reduce((total, child) => {
    if (child.id === options.excludeChildId) {
      return total;
    }

    return total + Number(child.plannedAmount);
  }, 0);

  const nextTotal = childSum + Number(options.nextChildAmount ?? 0);
  const parentAmount = Number(parent.plannedAmount);

  return {
    isValid: nextTotal <= parentAmount,
    childSum: nextTotal,
    parentAmount,
  };
}

export async function hasReceipts(budgetItemId: string) {
  const pending = [budgetItemId];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const currentId = pending.pop();

    if (!currentId || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    const [receiptCount, children] = await Promise.all([
      prisma.receipt.count({ where: { budgetItemId: currentId } }),
      prisma.budgetItem.findMany({
        where: { parentId: currentId },
        select: { id: true },
      }),
    ]);

    if (receiptCount > 0) {
      return true;
    }

    pending.push(...children.map((child) => child.id));
  }

  return false;
}
