import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";
import type { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { merge } from "lodash";
const FIXED_API = "https://example.com/api";

export function network(value: string) { return fetch(value); }
export function fixedNetwork(value: string) { return fetch("https://example.com/api", { method: "POST", body: value }); }
export function fixedOrigin(value: string) { return fetch(`${FIXED_API}/${value}`); }
export function dynamicOrigin(value: string) { return fetch(`https://${value}/api`); }
export function sql(pool: Pool, value: string) { return pool.query("SELECT * FROM users WHERE name = '" + value + "'"); }
export function boundSql(pool: Pool, value: string) { return pool.query("SELECT * FROM users WHERE name = $1", [value]); }
export function prismaSql(prisma: PrismaClient, value: string) { return prisma.$queryRawUnsafe("SELECT " + value); }
export function boundPrisma(prisma: PrismaClient, value: string) { return prisma.$queryRaw`SELECT ${value}`; }
export function file(value: string) { return readFile(value); }
export function normalizedFile(value: string) { return readFile(path.resolve("/srv/uploads", value)); }
export function fixedFile(value: string) { return writeFile("/srv/uploads/fixed.txt", value); }
export function redirectUrl(value: string) { return NextResponse.redirect(value); }
export function fixedRedirect(value: string) { return NextResponse.redirect("https://example.com/done"); }
export function evaluate(value: string) { return eval(value); }
export function parse(value: string) { return JSON.parse(value); }
export function populate(value: object) { return merge({}, value); }
export function safePopulate(value: object) { return { value }; }
export function logSecret(value: string) { console.info(value); }
export function maskSecret(value: string) { console.info("[REDACTED]"); }
export function unrelated(value: string) {
  const other = { query(text: string) {}, readFile(text: string) {}, redirect(text: string) {}, fetch(text: string) {} };
  other.query(value); other.readFile(value); other.redirect(value); other.fetch(value);
}
