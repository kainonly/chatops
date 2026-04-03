import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PROMPTS_PATH = path.join(process.cwd(), "prompts.json");

export async function GET() {
  try {
    const raw = await readFile(PROMPTS_PATH, "utf8");
    const prompts = JSON.parse(raw) as Array<{ key: string; label: string }>;
    return NextResponse.json(prompts);
  } catch {
    return NextResponse.json([]);
  }
}
