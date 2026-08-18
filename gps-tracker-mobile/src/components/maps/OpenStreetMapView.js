import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { OSM_ATTRIBUTION, OSM_TILE_URL } from '../../config/maps';

const DEFAULT_CENTER = {
  latitude: -6.2,
  longitude: 106.816666,
};

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizePoint = (point) => {
  const latitude = toNumber(point?.latitude);
  const longitude = toNumber(point?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    ...point,
    latitude,
    longitude,
  };
};

const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const buildMapHtml = () => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #dbe7e3; }
    .marker-dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 3px solid #fff;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.28);
    }
    .marker-cluster {
      min-width: 30px;
      height: 30px;
      padding: 0 6px;
      border-radius: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      border: 3px solid #fff;
      background: #f59e0b;
      color: #fff;
      font: 800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.28);
    }
    .popup-title {
      font: 700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #0f172a;
      margin-bottom: 3px;
    }
    .popup-copy {
      font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #475569;
      line-height: 1.35;
    }
    .leaflet-control-attribution { font-size: 10px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([${DEFAULT_CENTER.latitude}, ${DEFAULT_CENTER.longitude}], 13);
    const markersLayer = L.layerGroup().addTo(map);
    const circlesLayer = L.layerGroup().addTo(map);
    const polylineLayer = L.layerGroup().addTo(map);
    let hasAppliedViewport = false;

    L.tileLayer(${safeJson(OSM_TILE_URL)}, {
      maxZoom: 19,
      attribution: '&copy; ' + ${safeJson(OSM_ATTRIBUTION)}
    }).addTo(map);

    const escapeHtml = (value) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    const post = (payload) => {
      try {
        window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
      } catch (error) {}
    };
    const postViewport = () => {
      const bounds = map.getBounds();
      post({
        type: 'viewportChange',
        viewport: {
          south: bounds.getSouth(),
          north: bounds.getNorth(),
          west: bounds.getWest(),
          east: bounds.getEast(),
          zoom: map.getZoom()
        }
      });
    };
    const markerIcon = (marker) => {
      if (marker.kind === 'customer_cluster') {
        return L.divIcon({
          className: '',
          html: '<div class="marker-cluster">' + escapeHtml(marker.count || 0) + '</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -17]
        });
      }

      const color = marker.color || (marker.kind === 'customer_store' ? '#f59e0b' : '#0f766e');
      return L.divIcon({
        className: '',
        html: '<div class="marker-dot" style="background:' + color + '"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
      });
    };
    const addMarkers = (markers) => {
      markersLayer.clearLayers();
      markers.forEach((marker) => {
        const leafletMarker = L.marker([marker.latitude, marker.longitude], { icon: markerIcon(marker) })
          .addTo(markersLayer)
          .bindPopup(
            '<div class="popup-title">' + escapeHtml(marker.title || 'Lokasi') + '</div>' +
            '<div class="popup-copy">' + escapeHtml(marker.description || '') + '</div>'
          );
        leafletMarker.on('click', () => post({ type: 'markerPress', marker }));
      });
    };
    const addCircles = (circles) => {
      circlesLayer.clearLayers();
      circles.forEach((circle) => {
        L.circle([circle.latitude, circle.longitude], {
          radius: circle.radius,
          color: circle.strokeColor,
          fillColor: circle.fillColor,
          fillOpacity: 0.22,
          weight: 2
        }).addTo(circlesLayer);
      });
    };
    const addPolyline = (polyline) => {
      polylineLayer.clearLayers();
      if (polyline.length > 1) {
        L.polyline(polyline.map((point) => [point.latitude, point.longitude]), {
          color: '#0F766E',
          weight: 4,
          opacity: 0.82
        }).addTo(polylineLayer);
      }
    };
    const fitToContent = (payload) => {
      const points = [
        ...payload.markers,
        ...payload.circles,
        ...payload.polyline,
      ].map((point) => [point.latitude, point.longitude]);
      if (points.length > 1) {
        map.fitBounds(points, { padding: [28, 28], maxZoom: 16 });
      } else if (points.length === 1) {
        map.setView(points[0], Math.max(payload.zoom, 15));
      }
    };
    const updateMap = (payload) => {
      if (!payload || !payload.center) return;
      addMarkers(payload.markers || []);
      addCircles(payload.circles || []);
      addPolyline(payload.polyline || []);

      if (!hasAppliedViewport || payload.recenter) {
        map.setView([payload.center.latitude, payload.center.longitude], payload.zoom || 13);
        hasAppliedViewport = true;
      }
      if (payload.fitToContent) {
        fitToContent(payload);
      }
    };
    const receive = (rawMessage) => {
      try {
        const payload = JSON.parse(rawMessage);
        if (payload.type === 'updateMap') updateMap(payload);
      } catch (error) {}
    };

    document.addEventListener('message', (event) => receive(event.data));
    window.addEventListener('message', (event) => receive(event.data));
    map.on('moveend', postViewport);
    post({ type: 'mapReady' });
  </script>
</body>
</html>`;

const OpenStreetMapView = ({
  style,
  center = DEFAULT_CENTER,
  markers = [],
  circles = [],
  polyline = [],
  zoom = 13,
  viewportKey = 0,
  fitToContent = false,
  onMarkerPress,
  onViewportChange,
}) => {
  const webViewRef = useRef(null);
  const previousViewportKeyRef = useRef(viewportKey);
  const [mapReady, setMapReady] = useState(false);
  const normalizedMarkers = useMemo(
    () => markers.map(normalizePoint).filter(Boolean),
    [markers]
  );
  const normalizedCircles = useMemo(
    () => circles.map((circle) => {
      const point = normalizePoint(circle);
      if (!point) {
        return null;
      }

      const radius = toNumber(circle.radius);
      return {
        ...point,
        radius: Number.isFinite(radius) ? radius : 0,
        strokeColor: circle.strokeColor || 'rgba(30, 64, 175, 0.35)',
        fillColor: circle.fillColor || 'rgba(30, 64, 175, 0.12)',
      };
    }).filter((circle) => circle && circle.radius > 0),
    [circles]
  );
  const normalizedPolyline = useMemo(
    () => polyline.map(normalizePoint).filter(Boolean),
    [polyline]
  );
  const normalizedCenter = normalizePoint(center) || DEFAULT_CENTER;
  const centerKey = `${normalizedCenter.latitude}:${normalizedCenter.longitude}`;
  const previousCenterKeyRef = useRef(centerKey);
  const html = useMemo(() => buildMapHtml(), []);

  useEffect(() => {
    if (!mapReady || !webViewRef.current) {
      return;
    }

    const recenter = previousViewportKeyRef.current !== viewportKey
      || previousCenterKeyRef.current !== centerKey;
    previousViewportKeyRef.current = viewportKey;
    previousCenterKeyRef.current = centerKey;
    webViewRef.current.postMessage(safeJson({
      type: 'updateMap',
      center: normalizedCenter,
      markers: normalizedMarkers,
      circles: normalizedCircles,
      polyline: normalizedPolyline,
      zoom,
      recenter,
      fitToContent,
    }));
  }, [centerKey, fitToContent, mapReady, normalizedCenter, normalizedCircles, normalizedMarkers, normalizedPolyline, viewportKey, zoom]);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapReady') {
        setMapReady(true);
      } else if (data.type === 'markerPress') {
        onMarkerPress?.(data.marker);
      } else if (data.type === 'viewportChange') {
        onViewportChange?.(data.viewport);
      }
    } catch (error) {
      // Ignore malformed messages from the WebView.
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        scrollEnabled={false}
        style={styles.webview}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#dbe7e3',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default OpenStreetMapView;
