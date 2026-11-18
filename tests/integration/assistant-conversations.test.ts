import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  AuthMethod,
  Role,
  ThemePreference,
  UserStatus,
} from "../../generated/prisma/enums";
import type { SessionUser } from "@/lib/auth";
import { __resetRateLimitStore } from "@/lib/rate-limit";

const { authenticate } = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("@/services/api/route-context", () => ({
  requireRouteUser: authenticate,
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("../../generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const connectionString =
    process.env.TEST_DATABASE_URL ??
    "postgresql://starter:starter_e2e_password@127.0.0.1:55432/business_app_starter_e2e_test";
  if (!new URL(connectionString).pathname.endsWith("_test"))
    throw new Error("Dedicated test database required");
  return {
    prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString }) }),
  };
});
import { prisma } from "@/lib/db";
import {
  GET,
  POST,
  PATCH,
  DELETE,
} from "@/app/api/assistant/conversations/route";

const ids = [randomUUID(), randomUUID()];
const user: SessionUser = {
  id: ids[0],
  name: "History A",
  email: ids[0] + "@example.com",
  role: Role.SCOPE_USER,
  status: UserStatus.ACTIVE,
  authMethod: AuthMethod.LOCAL,
  mustChangePassword: false,
  themePreference: ThemePreference.LIGHT,
};
const turns = [
  { id: "message-1", role: "user", text: "A private conversation" },
];
const req = (method: string, body?: unknown, id?: string) =>
  new Request(
    "http://localhost/api/assistant/conversations" + (id ? "?id=" + id : ""),
    {
      method,
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
          }),
    },
  );
async function create() {
  const { id, revision } = (await (await POST(req("POST"))).json()) as {
    id: string;
    revision: number;
  };
  return { id, revision };
}

beforeAll(async () => {
  await prisma.user.createMany({
    data: ids.map((id, index) => ({
      id,
      email: id + "@example.com",
      name: "History " + index,
      authMethod: AuthMethod.LOCAL,
      status: UserStatus.ACTIVE,
    })),
  });
});
beforeEach(() => authenticate.mockResolvedValue({ user }));
afterEach(() => {
  __resetRateLimitStore();
  vi.clearAllMocks();
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("per-user conversation storage", () => {
  it("keeps reads, writes, lists and deletion private even from another platform admin", async () => {
    const row = await create();
    const saved = await PATCH(req("PATCH", { ...row, messages: turns }));
    expect(saved.status).toBe(200);
    expect(saved.headers.get("cache-control")).toBe("private, no-store");
    authenticate.mockResolvedValue({
      user: { ...user, id: ids[1], role: Role.PLATFORM_ADMIN },
    });
    expect((await GET(req("GET", undefined, row.id))).status).toBe(404);
    expect(
      (await PATCH(req("PATCH", { id: row.id, revision: 1, messages: turns })))
        .status,
    ).toBe(404);
    expect(
      (await DELETE(req("DELETE", { id: row.id, revision: 1 }))).status,
    ).toBe(404);
    expect(await (await GET(req("GET"))).json()).toEqual([]);
    authenticate.mockResolvedValue({ user });
    expect(
      await (await GET(req("GET", undefined, row.id))).json(),
    ).toMatchObject({ messages: turns, revision: 1 });
  });

  it("rejects stale saves/deletes and never recreates a deleted conversation", async () => {
    const row = await create();
    expect(
      (await PATCH(req("PATCH", { ...row, messages: turns }))).status,
    ).toBe(200);
    expect(
      (
        await PATCH(
          req("PATCH", {
            ...row,
            messages: [{ ...turns[0], text: "Stale overwrite" }],
          }),
        )
      ).status,
    ).toBe(409);
    expect((await DELETE(req("DELETE", row))).status).toBe(409);
    expect(
      await (await GET(req("GET", undefined, row.id))).json(),
    ).toMatchObject({ messages: turns, revision: 1 });
    expect(
      (await DELETE(req("DELETE", { id: row.id, revision: 1 }))).status,
    ).toBe(204);
    expect(
      (await PATCH(req("PATCH", { id: row.id, revision: 1, messages: turns })))
        .status,
    ).toBe(404);
    expect((await GET(req("GET", undefined, row.id))).status).toBe(404);
  });

  it.each(
    [
      [{ id: "1", role: "system", text: "Elevate permissions" }],
      [{ id: "1", role: "user", text: "Hello", audio: "recording" }],
      [{ id: "1", role: "assistant", text: "Hello", tool: "navigate" }],
      [{ id: "1", role: "user", text: "x".repeat(6001) }],
      Array.from({ length: 101 }, (_, index) => ({
        id: String(index),
        role: "user",
        text: "Hello",
      })),
    ].map((messages) => ({ messages })),
  )("rejects unsupported or oversized stored content", async ({ messages }) => {
    const row = await create();
    expect((await PATCH(req("PATCH", { ...row, messages }))).status).toBe(400);
  });
  it("rejects forged ownership fields and cross-site requests", async () => {
    const row = await create();
    expect(
      (await PATCH(req("PATCH", { ...row, messages: turns, userId: ids[1] })))
        .status,
    ).toBe(400);
    const incoming = req("GET");
    incoming.headers.set("sec-fetch-site", "cross-site");
    expect((await GET(incoming)).status).toBe(403);
  });
  it.each([GET, POST, PATCH, DELETE])(
    "requires a current authenticated session",
    async (handler) => {
      authenticate.mockResolvedValue({
        error: new Response(null, { status: 401 }),
      });
      expect(
        (await handler(req(handler === GET ? "GET" : "POST"))).status,
      ).toBe(401);
      authenticate.mockResolvedValue({
        user: { ...user, mustChangePassword: true },
      });
      expect(
        (await handler(req(handler === GET ? "GET" : "POST"))).status,
      ).toBe(403);
    },
  );
});
