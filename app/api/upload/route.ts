import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { auth } from "../../../auth";

const WORKSPACE_FILES_DIR = path.join(os.homedir(), ".openclaw", "workspace", "files");
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "未提供文件" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "文件超过 50MB 限制" }, { status: 413 });
  }

  await mkdir(WORKSPACE_FILES_DIR, { recursive: true });

  const ext = path.extname(file.name);
  const safeName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, "_");
  const filename = `${randomUUID()}-${safeName}${ext}`;
  const filepath = path.join(WORKSPACE_FILES_DIR, filename);

  const bytes = await file.arrayBuffer();
  await writeFile(filepath, Buffer.from(bytes));

  return NextResponse.json({
    url: `/api/files/${encodeURIComponent(filename)}`,
    name: file.name,
    path: filepath,
  });
}
