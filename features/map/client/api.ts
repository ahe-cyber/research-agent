import { withBasePath } from "@/lib/basePath";

export function getMapSources() {
  return fetch(withBasePath("/api/map"));
}

export function getGeometryLayers() {
  return fetch(withBasePath("/api/map?resource=geometry"));
}

export function saveGeometryLayers(layers: unknown[]) {
  return fetch(withBasePath("/api/map?resource=geometry"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layers })
  });
}

export function getPdfOverlays() {
  return fetch(withBasePath("/api/map?resource=overlay"));
}

export function savePdfOverlays(overlays: unknown[]) {
  return fetch(withBasePath("/api/map?resource=overlay"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overlays })
  });
}

export function uploadPdfOverlay(form: FormData) {
  return fetch(withBasePath("/api/map?resource=overlay"), { method: "POST", body: form });
}

export function queryMapSource(url: string) {
  return fetch(withBasePath("/api/map?resource=query"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url })
  });
}
