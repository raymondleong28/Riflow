import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}_${safeName}`;
    const filePath = path.join(uploadDir, uniqueName);

    await writeFile(filePath, buffer);

    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const sizeLabel =
      sizeKb >= 1024
        ? `${(sizeKb / 1024).toFixed(2)} MB`
        : `${sizeKb} KB`;

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      fileUrl: `/uploads/${uniqueName}`,
      fileSize: sizeLabel,
      mimeType: file.type || "application/octet-stream",
    });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
