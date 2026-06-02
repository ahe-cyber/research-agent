"use client";

import dynamic from "next/dynamic";
import Script from "next/script";
import { useState } from "react";

const MAPLIBRE_SCRIPT = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
const MAPBOX_SEARCH_SCRIPT = "https://api.mapbox.com/search-js/v1.5.0/web.js";
const App = dynamic(() => import("../../app/App.jsx"), { ssr: false });

export function WorkspaceClient() {
  const [isMapLibreReady, setIsMapLibreReady] = useState(false);
  const [isMapboxSearchReady, setIsMapboxSearchReady] = useState(false);

  return (
    <>
      <Script src={MAPLIBRE_SCRIPT} strategy="afterInteractive" onReady={() => setIsMapLibreReady(true)} />
      <Script id="search-js" src={MAPBOX_SEARCH_SCRIPT} strategy="afterInteractive" onReady={() => setIsMapboxSearchReady(true)} />
      {isMapLibreReady && isMapboxSearchReady ? <App /> : null}
    </>
  );
}
