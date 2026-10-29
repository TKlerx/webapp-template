import type { Pool } from "pg";
import type { PrismaClient } from "@prisma/client";
import { network, fixedNetwork, fixedOrigin, dynamicOrigin, sql, boundSql, prismaSql, boundPrisma, file, normalizedFile, fixedFile, redirectUrl, fixedRedirect, responseThenFixedRedirect, responseThenUnsafeRedirect, aliasReceiver, aliasReturn, aliasMutation, evaluate, parse, populate, safePopulate, logSecret, maskSecret, unrelated } from "./security-wrappers";
declare const pool: Pool;
declare const prisma: PrismaClient;

export async function unsafeSsrf(input: Request) { const data = await input.json(); network(data.value); }
export async function safeSsrf(input: Request) { const data = await input.json(); fixedNetwork(data.value); }
export async function safeFixedOrigin(input: Request) { const data = await input.json(); fixedOrigin(data.value); }
export async function unsafeDynamicOrigin(input: Request) { const data = await input.json(); dynamicOrigin(data.value); }
export async function unsafeSql(input: Request) { const data = await input.json(); sql(pool, data.value); }
export async function safeSql(input: Request) { const data = await input.json(); boundSql(pool, data.value); }
export async function unsafePrisma(input: Request) { const data = await input.json(); prismaSql(prisma, data.value); }
export async function safePrisma(input: Request) { const data = await input.json(); boundPrisma(prisma, data.value); }
export async function unsafePath(input: Request) { const data = await input.json(); file(data.value); }
export async function unsafeNormalizedPath(input: Request) { const data = await input.json(); normalizedFile(data.value); }
export async function safePath(input: Request) { const data = await input.json(); fixedFile(data.value); }
export async function unsafeRedirect(input: Request) { const data = await input.json(); redirectUrl(data.value); }
export async function safeRedirect(input: Request) { const data = await input.json(); fixedRedirect(data.value); }
export async function safeResponseIsolation(input: Request) { const data = await input.json(); responseThenFixedRedirect(data.value); }
export async function unsafeResponseRedirect(input: Request) { const data = await input.json(); responseThenUnsafeRedirect(data.value); }
export async function safeAliasReceiver(input: Request) { const data = await input.json(); aliasReceiver(data.value); }
export async function unsafeAliasReturn(input: Request) { const data = await input.json(); aliasReturn(data.value); }
export async function unsafeAliasMutation(input: Request) { const data = await input.json(); aliasMutation(data.value); }
export async function unsafeCode(input: Request) { const data = await input.json(); evaluate(data.value); }
export async function safeCode(input: Request) { const data = await input.json(); parse(data.value); }
export async function unsafePrototype(input: Request) { const data = await input.json(); populate(data.value); }
export async function safePrototype(input: Request) { const data = await input.json(); safePopulate(data.value); }
export async function unsafeLogging(input: Request) { const data = await input.json(); logSecret(data.password); }
export async function safeLogging(input: Request) { const data = await input.json(); maskSecret(data.password); }
export async function unrelatedSinks(input: Request) { const data = await input.json(); unrelated(data.value); }
