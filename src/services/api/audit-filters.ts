import { jsonError } from "@/lib/http";
import { AuditAction } from "../../../generated/prisma/enums";
import type { AuditFilters } from "@/services/api/types";

type AuditFilterParseError = { error: Response };
type ParsedAuditFilters = { filters: AuditFilters };
type ParsedAuditListRequest = {
  page: number;
  limit: number;
  filters: AuditFilters;
};
type ParsedAuditExportRequest = {
  format: string | null;
  filters: AuditFilters;
};

export function buildAuditFilters(filters: AuditFilters = {}) {
  return {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.scopeId ? { scopeId: filters.scopeId } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
  };
}

function parseAction(
  value: string | null,
): AuditFilterParseError | { action: AuditAction | null } {
  if (!value) {
    return { action: null as AuditAction | null };
  }

  if (!Object.values(AuditAction).includes(value as AuditAction)) {
    return { error: jsonError("Invalid audit action", 400) };
  }

  return { action: value as AuditAction };
}

function parseSharedFilters(
  searchParams: URLSearchParams,
): AuditFilterParseError | ParsedAuditFilters {
  const parsedAction = parseAction(searchParams.get("action"));
  if ("error" in parsedAction) {
    return parsedAction;
  }

  return {
    filters: {
      action: parsedAction.action,
      entityType: searchParams.get("entityType"),
      scopeId: searchParams.get("scopeId"),
      actorId: searchParams.get("actorId"),
      dateFrom: searchParams.get("dateFrom")
        ? new Date(searchParams.get("dateFrom")!)
        : null,
      dateTo: searchParams.get("dateTo")
        ? new Date(searchParams.get("dateTo")!)
        : null,
    } satisfies AuditFilters,
  };
}

export function parseAuditListRequest(
  request: Request,
): AuditFilterParseError | ParsedAuditListRequest {
  const url = new URL(request.url);
  const parsed = parseSharedFilters(url.searchParams);
  if ("error" in parsed) {
    return parsed;
  }

  return {
    page: Number(url.searchParams.get("page") ?? "1"),
    limit: Number(url.searchParams.get("limit") ?? "25"),
    filters: {
      ...parsed.filters,
      page: Number(url.searchParams.get("page") ?? "1"),
      limit: Number(url.searchParams.get("limit") ?? "25"),
    } satisfies AuditFilters,
  };
}

export function parseAuditExportRequest(
  request: Request,
): AuditFilterParseError | ParsedAuditExportRequest {
  const url = new URL(request.url);
  const parsed = parseSharedFilters(url.searchParams);
  if ("error" in parsed) {
    return parsed;
  }

  return {
    format: url.searchParams.get("format"),
    filters: parsed.filters,
  };
}
