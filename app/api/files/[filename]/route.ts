import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { auth } from "../../../../auth";

const WORKSPACE_FILES_DIR = path.join(os.homedir(), ".openclaw", "workspace", "files");

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".zip": "application/zip",
  ".md": "text/markdown; charset=utf-8",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { filename } = await params;
  // 防止路径穿越
  const safeName = path.basename(decodeURIComponent(filename));
  const filepath = path.join(WORKSPACE_FILES_DIR, safeName);

  try {
    const file = await readFile(filepath);
    const ext = path.extname(safeName).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
