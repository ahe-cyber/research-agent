const GEOJSON_LAYER_PREFIX = "record-geojson";

export function getSearchResultCoordinates(searchResult) {
  const feature = searchResult.features && searchResult.features[0];
  const geometryCoordinates = feature && feature.geometry && feature.geometry.coordinates;
  const propertyCoordinates = feature && feature.properties && feature.properties.coordinates;

  if (Array.isArray(geometryCoordinates)) {
    return geometryCoordinates;
  }

  if (propertyCoordinates && propertyCoordinates.longitude && propertyCoordinates.latitude) {
    return [propertyCoordinates.longitude, propertyCoordinates.latitude];
  }

  return null;
}

export function buildUrlWithParams(baseUrl, params) {
  const url = new URL(baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (key) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

export async function queryUrl(url) {
  const startedAt = performance.now();
  let proxyResponse;

  try {
    proxyResponse = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });
  } catch (error) {
    throw createQueryError("Query proxy request failed.", {
      url,
      durationMs: Math.round(performance.now() - startedAt),
      originalError: error.message
    });
  }

  const proxyPayload = await proxyResponse.json().catch(() => null);

  if (!proxyResponse.ok || !proxyPayload) {
    throw createQueryError("Query proxy returned an invalid response.", {
      url,
      status: proxyResponse.status,
      durationMs: Math.round(performance.now() - startedAt),
      proxyPayload
    });
  }

  const {
    contentType = "",
    durationMs = Math.round(performance.now() - startedAt),
    request,
    response,
    responsePreview,
    responseText,
    status,
    statusText,
    timestamp
  } = proxyPayload;

  if (!proxyPayload.ok) {
    throw createQueryError(`Query failed with status ${status}`, {
      url,
      status,
      statusText,
      contentType,
      durationMs,
      responsePreview,
      parseError: proxyPayload.parseError
    });
  }

  if (!response) {
    throw createQueryError("Query returned a non-JSON response.", {
      url,
      status,
      statusText,
      contentType,
      durationMs,
      responsePreview
    });
  }

  return {
    request,
    response,
    responseText,
    durationMs,
    timestamp
  };
}

function createQueryError(message, details) {
  const error = new Error(message);
  error.details = details;
  return error;
}

function getGeoJsonLayerIds(recordId) {
  return {
    sourceId: `${GEOJSON_LAYER_PREFIX}-${recordId}`,
    circleLayerId: `${GEOJSON_LAYER_PREFIX}-${recordId}-circle`,
    fillLayerId: `${GEOJSON_LAYER_PREFIX}-${recordId}-fill`,
    lineLayerId: `${GEOJSON_LAYER_PREFIX}-${recordId}-line`
  };
}

function ensureGeoJsonLayers(map, recordId, geojson) {
  const { sourceId, circleLayerId, fillLayerId, lineLayerId } = getGeoJsonLayerIds(recordId);

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: "geojson",
      data: geojson
    });
  }

  if (!map.getLayer(fillLayerId)) {
    map.addLayer({
      id: fillLayerId,
      type: "fill",
      source: sourceId,
      filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
      paint: {
        "fill-color": "#2f6fed",
        "fill-opacity": 0.22
      }
    });
  }

  if (!map.getLayer(lineLayerId)) {
    map.addLayer({
      id: lineLayerId,
      type: "line",
      source: sourceId,
      filter: [
        "any",
        ["==", ["geometry-type"], "LineString"],
        ["==", ["geometry-type"], "MultiLineString"],
        ["==", ["geometry-type"], "Polygon"],
        ["==", ["geometry-type"], "MultiPolygon"]
      ],
      paint: {
        "line-color": "#1f2933",
        "line-width": 2
      }
    });
  }

  if (!map.getLayer(circleLayerId)) {
    map.addLayer({
      id: circleLayerId,
      type: "circle",
      source: sourceId,
      filter: ["any", ["==", ["geometry-type"], "Point"], ["==", ["geometry-type"], "MultiPoint"]],
      paint: {
        "circle-color": "#2f6fed",
        "circle-radius": 5,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5
      }
    });
  }
}

export function showGeoJsonRecord(map, recordId, geojson) {
  ensureGeoJsonLayers(map, recordId, geojson);
  map.getSource(getGeoJsonLayerIds(recordId).sourceId).setData(geojson);
}

export function hideGeoJsonRecord(map, recordId) {
  const { sourceId, circleLayerId, fillLayerId, lineLayerId } = getGeoJsonLayerIds(recordId);

  if (map.getLayer(fillLayerId)) {
    map.removeLayer(fillLayerId);
  }

  if (map.getLayer(lineLayerId)) {
    map.removeLayer(lineLayerId);
  }

  if (map.getLayer(circleLayerId)) {
    map.removeLayer(circleLayerId);
  }

  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

export function normalizeGeoJson(value) {
  if (!value) {
    return null;
  }

  if (isGeoJsonGeometry(value)) {
    return {
      type: "Feature",
      properties: {},
      geometry: value
    };
  }

  if (value.type === "Feature" && isGeoJsonFeature(value)) {
    return value;
  }

  if (
    value.type === "FeatureCollection" &&
    Array.isArray(value.features) &&
    value.features.length > 0 &&
    value.features.every(isGeoJsonFeature)
  ) {
    return value;
  }

  if (Array.isArray(value) && value.length > 0 && value.every(isGeoJsonFeature)) {
    return {
      type: "FeatureCollection",
      features: value
    };
  }

  return null;
}

function isGeoJsonFeature(feature) {
  return Boolean(
    feature &&
    feature.type === "Feature" &&
    feature.geometry &&
    isGeoJsonGeometry(feature.geometry)
  );
}

function isGeoJsonGeometry(geometry) {
  return Boolean(
    geometry &&
    (
      geometry.type === "Point" ||
      geometry.type === "MultiPoint" ||
      geometry.type === "LineString" ||
      geometry.type === "MultiLineString" ||
      geometry.type === "Polygon" ||
      geometry.type === "MultiPolygon"
    ) &&
    Array.isArray(geometry.coordinates)
  );
}
