import { redirect } from "next/navigation";
import { TokenList } from "@/components/tokens/token-list";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listAllTokens } from "@/services/api/tokens";
import { Role } from "../../../../../generated/prisma/enums";

export default async function AdminTokensPage() {
  const user = await requireSession();
  if (user.role !== Role.PLATFORM_ADMIN) {
    redirect("/dashboard");
  }

  const [tokens, users] = await Promise.all([
    listAllTokens({ showAll: false }),
    prisma.user.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
  ]);

  return <TokenList adminMode initialTokens={tokens} users={users} />;
}
