const MAPPLUTO_QUERY_URL = "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0/query";
const MAPPLUTO_LAYER_OVERVIEW_URL = "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0";
const GEOJSON_LAYER_PREFIX = "record-geojson";

function getSearchResultCoordinates(searchResult) {
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

function buildMapPlutoCoordinateQuery(coordinates) {
  const params = new URLSearchParams({
    geometry: coordinates.join(","),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson"
  });

  return `${MAPPLUTO_QUERY_URL}?${params.toString()}`;
}

async function queryMapPlutoByCoordinates(coordinates) {
  const startedAt = performance.now();
  const url = buildMapPlutoCoordinateQuery(coordinates);
  const response = await fetch(url);
  const durationMs = Math.round(performance.now() - startedAt);

  if (!response.ok) {
    throw new Error(`MAPPLUTO query failed with status ${response.status}`);
  }

  return {
    request: {
      method: "GET",
      url,
      coordinates
    },
    response: await response.json(),
    durationMs,
    timestamp: new Date().toISOString()
  };
}

function buildUrlWithParams(baseUrl, params) {
  const url = new URL(baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (key) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function queryUrl(url) {
  const startedAt = performance.now();
  const response = await fetch(url);
  const durationMs = Math.round(performance.now() - startedAt);

  if (!response.ok) {
    throw new Error(`Query failed with status ${response.status}`);
  }

  return {
    request: {
      method: "GET",
      url
    },
    response: await response.json(),
    durationMs,
    timestamp: new Date().toISOString()
  };
}

function getGeoJsonLayerIds(recordId) {
  return {
    sourceId: `${GEOJSON_LAYER_PREFIX}-${recordId}`,
    fillLayerId: `${GEOJSON_LAYER_PREFIX}-${recordId}-fill`,
    lineLayerId: `${GEOJSON_LAYER_PREFIX}-${recordId}-line`
  };
}

function ensureGeoJsonLayers(map, recordId, geojson) {
  const { sourceId, fillLayerId, lineLayerId } = getGeoJsonLayerIds(recordId);

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
      paint: {
        "line-color": "#1f2933",
        "line-width": 2
      }
    });
  }
}

function showGeoJsonRecord(map, recordId, geojson) {
  ensureGeoJsonLayers(map, recordId, geojson);
  map.getSource(getGeoJsonLayerIds(recordId).sourceId).setData(geojson);
}

function hideGeoJsonRecord(map, recordId) {
  const { sourceId, fillLayerId, lineLayerId } = getGeoJsonLayerIds(recordId);

  if (map.getLayer(fillLayerId)) {
    map.removeLayer(fillLayerId);
  }

  if (map.getLayer(lineLayerId)) {
    map.removeLayer(lineLayerId);
  }

  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

function getFirstMapPlutoFeature(featureCollection) {
  if (!featureCollection.features || featureCollection.features.length === 0) {
    return null;
  }

  return featureCollection.features[0];
}

function isGeoJsonValue(value) {
  return Boolean(normalizeGeoJson(value));
}

function normalizeGeoJson(value) {
  if (!value) {
    return null;
  }

  if (isPolygonGeometry(value)) {
    return {
      type: "Feature",
      properties: {},
      geometry: value
    };
  }

  if (value.type === "Feature" && isPolygonFeature(value)) {
    return value;
  }

  if (
    value.type === "FeatureCollection" &&
    Array.isArray(value.features) &&
    value.features.length > 0 &&
    value.features.every(isPolygonFeature)
  ) {
    return value;
  }

  if (Array.isArray(value) && value.every(isPolygonFeature)) {
    return {
      type: "FeatureCollection",
      features: value
    };
  }

  return null;
}

function isPolygonFeature(feature) {
  return Boolean(
    feature &&
    feature.type === "Feature" &&
    feature.geometry &&
    (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")
  );
}

function isPolygonGeometry(geometry) {
  return Boolean(
    geometry &&
    (geometry.type === "Polygon" || geometry.type === "MultiPolygon") &&
    Array.isArray(geometry.coordinates)
  );
}
