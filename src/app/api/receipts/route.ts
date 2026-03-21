import { authorizeRoute } from "@/lib/route-auth";
import { prisma } from "@/lib/db";
import { Role, ReviewStatus } from "../../../../generated/prisma/enums";

export async function GET(request: Request) {
  const auth = await authorizeRoute(request, {
    roles: [Role.GVI_FINANCE_ADMIN, Role.COUNTRY_ADMIN, Role.COUNTRY_FINANCE],
  });
  if ("error" in auth) {
    return auth.error;
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const status = url.searchParams.get("status") as ReviewStatus | null;
  const countryId = url.searchParams.get("country");
  const budgetItemId = url.searchParams.get("budgetItemId");
  const submitter = url.searchParams.get("submitter");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  const where = {
    ...(status ? { reviewStatus: status } : {}),
    ...(budgetItemId ? { budgetItemId } : {}),
    ...(submitter
      ? {
          uploadedBy: {
            OR: [
              { name: { contains: submitter } },
              { email: { contains: submitter } },
            ],
          },
        }
      : {}),
    ...((dateFrom || dateTo)
      ? {
          date: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    budgetItem: {
      countryBudget: {
        countryId:
          auth.user.role === Role.GVI_FINANCE_ADMIN
            ? countryId ?? undefined
            : auth.user.role === Role.COUNTRY_ADMIN
              ? {
                  in: await prisma.userCountryAssignment
                    .findMany({
                      where: { userId: auth.user.id },
                      select: { countryId: true },
                    })
                    .then((assignments) => assignments.map((assignment) => assignment.countryId)),
                }
              : countryId ?? undefined,
      },
    },
    ...(auth.user.role === Role.COUNTRY_FINANCE ? { uploadedById: auth.user.id } : {}),
  };

  const [total, receipts] = await Promise.all([
    prisma.receipt.count({ where }),
    prisma.receipt.findMany({
      where,
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        budgetItem: {
          include: {
            countryBudget: {
              include: {
                country: true,
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return Response.json({
    data: receipts.map((receipt) => ({
      id: receipt.id,
      amount: Number(receipt.amount),
      currency: receipt.currency,
      date: receipt.date,
      description: receipt.description,
      fileName: receipt.fileName,
      mimeType: receipt.mimeType,
      reviewStatus: receipt.reviewStatus,
      submitter: receipt.uploadedBy,
      budgetItem: {
        id: receipt.budgetItem.id,
        name: receipt.budgetItem.name,
      },
      country: {
        id: receipt.budgetItem.countryBudget.country.id,
        name: receipt.budgetItem.countryBudget.country.name,
      },
    })),
    total,
    page,
    limit,
  });
}
