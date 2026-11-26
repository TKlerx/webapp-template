import { Badge } from "@mantine/core";
import type { HealthStatus } from "@/lib/ops-health";

const colorByStatus: Record<HealthStatus, string> = {
  healthy: "teal",
  degraded: "red",
  unknown: "yellow",
  unavailable: "gray",
};

export function HealthStatusBadge({
  status,
  label,
}: {
  status: HealthStatus;
  label: string;
}) {
  return (
    <Badge
      className="normal-case"
      color={colorByStatus[status]}
      variant="light"
    >
      {label}
    </Badge>
  );
}
