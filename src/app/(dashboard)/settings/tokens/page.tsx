import { CreateTokenDialog } from "@/components/tokens/create-token-dialog";
import { TokenList } from "@/components/tokens/token-list";
import { requireSession } from "@/lib/auth";
import { listTokens } from "@/services/api/tokens";

export default async function TokensPage() {
  const user = await requireSession();
  const tokens = await listTokens(user.id, false);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <CreateTokenDialog />
      <TokenList initialTokens={tokens} />
    </div>
  );
}
