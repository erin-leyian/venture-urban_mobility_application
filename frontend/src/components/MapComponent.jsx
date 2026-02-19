import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

const API_BASE_URL = "http://localhost:5000/api";

const MapComponent = () => {
  const [geoData, setGeoData] = useState(null);
  const [zoneStats, setZoneStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch GeoJSON from a reliable source
        const geoResponse = await axios.get(
          "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/new-york-city-taxi-zones.geojson",
        );

        // 2. Fetch Zone Stats from our API
        const statsResponse = await axios.get(
          `${API_BASE_URL}/statistics/by-zone`,
        );

        setGeoData(geoResponse.data);

        // Ensure stats are keyed by stringified location_id for consistent lookup
        const rawStats = statsResponse.data || {};
        const stats = {};
        Object.keys(rawStats).forEach((key) => {
          stats[String(key)] = rawStats[key];
        });
        setZoneStats(stats);
        setLoading(false);
      } catch (error) {
        console.error("Error loading map data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getColor = (count) => {
    return count > 5000
      ? "#800026"
      : count > 2000
        ? "#BD0026"
        : count > 1000
          ? "#E31A1C"
          : count > 500
            ? "#FC4E2A"
            : count > 200
              ? "#FD8D3C"
              : count > 100
                ? "#FEB24C"
                : count > 50
                  ? "#FED976"
                  : "#FFEDA0";
  };

  const styles = (feature) => {
    // Feature.properties.location_id corresponds to our zone ID
    // Note: The GeoJSON might have location_id as string or number in properties
    // For NYC Taxi Zones GeoJSON often used: location_id or objectid
    const props = feature.properties;
    const locationId = String(
      props.location_id || props.objectid || props.LocationID || "",
    );
    const count = zoneStats[locationId] || 0;

    return {
      fillColor: getColor(count),
      weight: 1,
      opacity: 1,
      color: "white",
      dashArray: "3",
      fillOpacity: 0.7,
    };
  };

  const onEachFeature = (feature, layer) => {
    const props = feature.properties;
    const locationId = String(
      props.location_id || props.objectid || props.LocationID || "",
    );
    const count = zoneStats[locationId] || 0;
    const zoneName = props.zone || props.zone_name || "Unknown Zone";
    const borough = props.borough || "Unknown Borough";

    layer.bindTooltip(
      `
            <div class="text-sm font-sans">
                <strong>${zoneName}</strong> (${borough})<br/>
                Trips: ${count}
            </div>
        `,
      {
        permanent: false,
        direction: "top",
        className: "custom-tooltip",
      },
    );
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white bg-[#09090b]">
        Loading Map...
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden relative border border-[#333] shadow-2xl bg-[#09090b] z-0">
      <MapContainer
        center={[40.7128, -74.006]}
        zoom={10}
        style={{ height: "100%", width: "100%", background: "#09090b" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {geoData && (
          <GeoJSON
            data={geoData}
            style={styles}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* Legend Overlay */}
      <div className="absolute bottom-6 right-6 bg-[#1a1a1a] px-4 py-2 rounded-lg border border-[#333] z-[1000] text-white text-xs">
        <div className="font-bold mb-2">Trip Density</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4" style={{ background: "#800026" }}></span>{" "}
            &gt; 5000
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4" style={{ background: "#E31A1C" }}></span>{" "}
            1000 - 5000
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4" style={{ background: "#FD8D3C" }}></span>{" "}
            200 - 1000
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4" style={{ background: "#FFEDA0" }}></span>{" "}
            &lt; 200
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;
