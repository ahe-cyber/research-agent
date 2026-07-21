import { getPdfOverlays, savePdfOverlays, uploadPdfOverlay } from "@/features/map/server/overlayRoute";

export const GET = getPdfOverlays;
export const POST = uploadPdfOverlay;
export const PUT = savePdfOverlays;
