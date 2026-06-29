import * as Lerc from "lerc";
import sharp from "sharp";
import { jsonResponse } from "../../../../_lib/files";

const NYC_TOPOBATHYMETRIC_DEM_URL = "https://elevation.its.ny.gov/arcgis/rest/services/NYC_TopoBathymetric_2017_1_meter/ImageServer/exportImage";
const WEB_MERCATOR_HALF_WORLD = 20037508.342789244;
const NYC_TOPOBATHYMETRIC_DEM_BOUNDS = {
  xmin: -8266307.1821361203,
  ymin: 4937589.791525625,
  xmax: -8204027.307190664,
  ymax: 5000028.37647827
};
const TERRAIN_TILE_SIZE = 256;
const TERRAIN_RGB_ZERO_ELEVATION = 100000;

interface RouteContext {
  params: Promise<{
    z: string;
    x: string;
    y: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const z = Number(params.z);
  const x = Number(params.x);
  const y = Number(params.y.replace(/\.png$/i, ""));

  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 18 || !/\.png$/i.test(params.y)) {
    return jsonResponse({ error: "Invalid terrain tile coordinates." }, { status: 400 });
  }

  const tileCount = 2 ** z;
  if (x < 0 || x >= tileCount || y < 0 || y >= tileCount) {
    return new Response(null, { status: 404 });
  }

  try {
    const tileWidth = (WEB_MERCATOR_HALF_WORLD * 2) / tileCount;
    const xmin = -WEB_MERCATOR_HALF_WORLD + x * tileWidth;
    const xmax = xmin + tileWidth;
    const ymax = WEB_MERCATOR_HALF_WORLD - y * tileWidth;
    const ymin = ymax - tileWidth;
    const clippedBounds = {
      xmin: Math.max(xmin, NYC_TOPOBATHYMETRIC_DEM_BOUNDS.xmin),
      ymin: Math.max(ymin, NYC_TOPOBATHYMETRIC_DEM_BOUNDS.ymin),
      xmax: Math.min(xmax, NYC_TOPOBATHYMETRIC_DEM_BOUNDS.xmax),
      ymax: Math.min(ymax, NYC_TOPOBATHYMETRIC_DEM_BOUNDS.ymax)
    };
    const terrainRgb = createFlatTerrainRgbTile();

    if (clippedBounds.xmin >= clippedBounds.xmax || clippedBounds.ymin >= clippedBounds.ymax) {
      return terrainPngResponse(await encodeTerrainRgbTile(terrainRgb), 86400);
    }

    const pixelWidth = tileWidth / TERRAIN_TILE_SIZE;
    const left = Math.max(0, Math.floor((clippedBounds.xmin - xmin) / pixelWidth));
    const right = Math.min(TERRAIN_TILE_SIZE, Math.ceil((clippedBounds.xmax - xmin) / pixelWidth));
    const top = Math.max(0, Math.floor((ymax - clippedBounds.ymax) / pixelWidth));
    const bottom = Math.min(TERRAIN_TILE_SIZE, Math.ceil((ymax - clippedBounds.ymin) / pixelWidth));
    const exportBounds = {
      xmin: xmin + left * pixelWidth,
      ymin: ymax - bottom * pixelWidth,
      xmax: xmin + right * pixelWidth,
      ymax: ymax - top * pixelWidth
    };
    const upstreamParams = new URLSearchParams({
      bbox: `${exportBounds.xmin},${exportBounds.ymin},${exportBounds.xmax},${exportBounds.ymax}`,
      bboxSR: "3857",
      imageSR: "3857",
      size: `${right - left},${bottom - top}`,
      format: "lerc",
      pixelType: "F32",
      interpolation: "RSP_BilinearInterpolation",
      f: "image"
    });
    const upstream = await fetch(`${NYC_TOPOBATHYMETRIC_DEM_URL}?${upstreamParams}`);
    if (!upstream.ok) {
      throw new Error(`ImageServer responded with ${upstream.status}`);
    }

    await Lerc.load();
    const { width, height, pixels, mask } = Lerc.decode(await upstream.arrayBuffer()) as any;
    const elevations = pixels[0];

    for (let pixel = 0; pixel < width * height; pixel++) {
      const elevation = elevations[pixel];
      const encoded = (!mask || mask[pixel]) && Number.isFinite(elevation)
        ? Math.max(0, Math.min(16777215, Math.round((elevation + 10000) * 10)))
        : TERRAIN_RGB_ZERO_ELEVATION;
      const sourceX = pixel % width;
      const sourceY = Math.floor(pixel / width);
      writeTerrainRgbPixel(terrainRgb, (top + sourceY) * TERRAIN_TILE_SIZE + left + sourceX, encoded);
    }

    return terrainPngResponse(await encodeTerrainRgbTile(terrainRgb), 86400);
  } catch (error) {
    console.error("[Terrain] Failed to build NYC topobathymetric tile", error);
    try {
      return terrainPngResponse(await encodeTerrainRgbTile(createFlatTerrainRgbTile()), 300);
    } catch {
      return jsonResponse({ error: "Failed to build terrain tile." }, { status: 502 });
    }
  }
}

function terrainPngResponse(tile: Buffer, maxAge: number) {
  return new Response(new Uint8Array(tile), {
    headers: {
      "Cache-Control": `public, max-age=${maxAge}`,
      "Content-Type": "image/png"
    }
  });
}

function createFlatTerrainRgbTile() {
  const tile = Buffer.alloc(TERRAIN_TILE_SIZE * TERRAIN_TILE_SIZE * 3);
  for (let pixel = 0; pixel < TERRAIN_TILE_SIZE * TERRAIN_TILE_SIZE; pixel++) {
    writeTerrainRgbPixel(tile, pixel, TERRAIN_RGB_ZERO_ELEVATION);
  }
  return tile;
}

function writeTerrainRgbPixel(tile: Buffer, pixel: number, encoded: number) {
  tile[pixel * 3] = Math.floor(encoded / 65536);
  tile[pixel * 3 + 1] = Math.floor((encoded % 65536) / 256);
  tile[pixel * 3 + 2] = encoded % 256;
}

function encodeTerrainRgbTile(tile: Buffer) {
  return sharp(tile, {
    raw: { width: TERRAIN_TILE_SIZE, height: TERRAIN_TILE_SIZE, channels: 3 }
  }).png().toBuffer();
}
