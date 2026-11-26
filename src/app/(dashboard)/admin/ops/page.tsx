import { redirect } from "next/navigation";
import { Role } from "../../../../../generated/prisma/enums";
import { OpsHealthDashboard } from "@/components/ops";
import "@mantine/core/styles/Badge.layer.css";
import { requireSession } from "@/lib/auth";
import { buildOpsHealthSnapshot } from "@/lib/ops-health";

export default async function OpsHealthPage() {
  const user = await requireSession();

  if (user.role !== Role.PLATFORM_ADMIN) {
    redirect("/dashboard");
  }

  const snapshot = await buildOpsHealthSnapshot();

  return <OpsHealthDashboard initialSnapshot={snapshot} />;
}
