import { readFile } from "node:fs/promises";
import path from "node:path";

const FEATURE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ feature: string }> | { feature: string } }
) {
  const { feature } = await params;

  if (!FEATURE_ID_PATTERN.test(feature)) {
    return new Response("Invalid feature id", { status: 400 });
  }

  const iconPath = path.join(process.cwd(), "features", feature, `${feature}.icon.svg`);

  try {
    const icon = await readFile(iconPath, "utf8");
    return new Response(icon, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "image/svg+xml; charset=utf-8"
      }
    });
  } catch {
    return new Response("Feature icon not found", { status: 404 });
  }
}
