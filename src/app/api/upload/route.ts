import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { captureError, incrementMetric } from "@/server/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOADS = path.join(process.cwd(), "public", "generated", "uploads");

/** Receive a reference image (multipart) → save under public/generated/uploads → return its URL.
 *  The URL is passed as `refImageUrl` to /api/generate, where Claude vision describes it. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
    const ext = (file.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
    await mkdir(UPLOADS, { recursive: true });
    const name = `${Date.now().toString(36)}.${ext}`;
    await writeFile(path.join(UPLOADS, name), Buffer.from(await file.arrayBuffer()));
    incrementMetric("upload.completed");
    return NextResponse.json({ url: `/generated/uploads/${name}`, name: file.name });
  } catch (e) {
    captureError(e, { route: "upload" });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
