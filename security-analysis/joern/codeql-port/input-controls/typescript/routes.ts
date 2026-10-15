import type { NextRequest } from "next/server";
import { unsafeShell, safeProgram } from "./wrappers";
import { parseJsonBody, parseFormBody } from "./lib/validation";
import { z } from "zod";
const schema = z.object({ command: z.string() }).strict();

export async function unsafeJson(input: Request) { const data = await input.json(); unsafeShell(data.command); }
export async function safeJson(input: Request) { const data = await input.json(); safeProgram(data.command); }
export async function unsafeForm(input: Request) { const data = await input.formData(); unsafeShell(String(data.get("command"))); }
export async function safeForm(input: Request) { const data = await input.formData(); safeProgram(String(data.get("command"))); }
export function unsafeQuery(input: NextRequest) { unsafeShell(input.nextUrl.searchParams.get("command")!); }
export function safeQuery(input: NextRequest) { safeProgram(input.nextUrl.searchParams.get("command")!); }
export function unsafeHeader(input: Request) { unsafeShell(input.headers.get("x-command")!); }
export function safeHeader(input: Request) { safeProgram(input.headers.get("x-command")!); }
export function unsafeCookie(input: NextRequest) { unsafeShell(input.cookies.get("command")!.value); }
export function safeCookie(input: NextRequest) { safeProgram(input.cookies.get("command")!.value); }
export function unsafeUrl(input: Request) { unsafeShell(new URL(input.url).searchParams.get("command")!); }
export function safeUrl(input: Request) { safeProgram(new URL(input.url).searchParams.get("command")!); }
export async function unsafeJsonHelper(input: Request) { const parsed = await parseJsonBody(input, schema); if ("data" in parsed) unsafeShell(parsed.data.command); }
export async function safeJsonHelper(input: Request) { const parsed = await parseJsonBody(input, schema); if ("data" in parsed) safeProgram(parsed.data.command); }
export async function unsafeFormHelper(input: Request) { const parsed = await parseFormBody(input, schema); if ("data" in parsed) unsafeShell(parsed.data.command); }
export async function safeFormHelper(input: Request) { const parsed = await parseFormBody(input, schema); if ("data" in parsed) safeProgram(parsed.data.command); }
export async function unsafeParams(input: Request, context: { params: Promise<{command: string}> }) { const values = await context.params; unsafeShell(values.command); }
export async function safeParams(input: Request, context: { params: Promise<{command: string}> }) { const values = await context.params; safeProgram(values.command); }
export async function unrelatedReader(input: {json(): Promise<any>}) { const values = await input.json(); unsafeShell(values.command); }
