"use client";

import dynamic from "next/dynamic";
import Script from "next/script";
import { useEffect, useState } from "react";

const MAPLIBRE_SCRIPT = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
const MAPBOX_SEARCH_SCRIPT = "https://api.mapbox.com/search-js/v1.5.0/web.js";
const App = dynamic(() => import("../../App.jsx"), { ssr: false });

function scriptsReady() {
  return (
    typeof (window as any).maplibregl !== "undefined" &&
    typeof (window as any).mapboxsearch !== "undefined"
  );
}

export function WorkspaceClient() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (scriptsReady()) { setReady(true); return; }
    const id = setInterval(() => {
      if (scriptsReady()) { setReady(true); clearInterval(id); }
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <Script src={MAPLIBRE_SCRIPT} strategy="afterInteractive" />
      <Script id="search-js" src={MAPBOX_SEARCH_SCRIPT} strategy="afterInteractive" />
      {ready ? <App /> : null}
    </>
  );
}
