import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { objectStorage } from "@/lib/storage/object-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const file = await prisma.file.findUnique({
    where: { id },
    select: {
      id: true,
      fileType: true,
      storageKey: true,
      course: {
        select: { userId: true },
      },
    },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const data = await objectStorage.get(file.storageKey);

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": file.fileType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error(
      "[FileAPI] Failed to serve file:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Failed to load file" },
      { status: 500 }
    );
  }
}
