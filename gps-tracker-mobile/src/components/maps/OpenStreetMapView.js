import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { OSM_ATTRIBUTION, OSM_ATTRIBUTION_URL, OSM_TILE_URL } from '../../config/maps';
import { logEvent } from '../../utils/diagnosticLogger';

const DEFAULT_CENTER = {
  latitude: -6.2,
  longitude: 106.816666,
};

const toNumber = (value) => {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const isValidCoordinate = (latitude, longitude) => (
  Number.isFinite(latitude)
  && Number.isFinite(longitude)
  && latitude >= -90
  && latitude <= 90
  && longitude >= -180
  && longitude <= 180
);

const safeColor = (value, fallback) => (
  typeof value === 'string'
  && /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\))$/i.test(value)
    ? value
    : fallback
);

const normalizePoint = (point) => {
  const latitude = toNumber(point?.latitude);
  const longitude = toNumber(point?.longitude);

  if (!isValidCoordinate(latitude, longitude)) {
    return null;
  }

  return {
    ...point,
    latitude,
    longitude,
  };
};

const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const buildMapHtml = (initialCenter, initialZoom) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
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
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([${initialCenter.latitude}, ${initialCenter.longitude}], ${initialZoom});
    const markersLayer = L.layerGroup().addTo(map);
    const circlesLayer = L.layerGroup().addTo(map);
    const polylineLayer = L.layerGroup().addTo(map);
    let hasAppliedViewport = false;

    L.tileLayer(${safeJson(OSM_TILE_URL)}, {
      maxZoom: 19,
      attribution: '&copy; <a href="' + ${safeJson(OSM_ATTRIBUTION_URL)} + '">' + ${safeJson(OSM_ATTRIBUTION)} + '</a>'
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

      const color = safeColor(marker.color, marker.kind === 'customer_store' ? '#f59e0b' : '#0f766e');
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
        const leafletMarker = L.marker([marker.latitude, marker.longitude], {
          icon: markerIcon(marker),
          zIndexOffset: Number(marker.zIndexOffset || 0),
        })
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
    postViewport();
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
          strokeColor: safeColor(circle.strokeColor, 'rgba(30, 64, 175, 0.35)'),
          fillColor: safeColor(circle.fillColor, 'rgba(30, 64, 175, 0.12)'),
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
  const initialViewportRef = useRef({ center: normalizedCenter, zoom });
  const html = useMemo(
    () => buildMapHtml(initialViewportRef.current.center, initialViewportRef.current.zoom),
    []
  );

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
        const marker = data.marker;
        const point = normalizePoint(marker);
        const allowedKinds = new Set(['branch', 'customer_cluster', 'customer_store', 'store', 'user']);
        if (!point || !allowedKinds.has(marker?.kind)) return;
        const safeId = (value) => (
          (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
          || (typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value))
          ? value
          : undefined
        );
        onMarkerPress?.({
          kind: marker.kind,
          latitude: point.latitude,
          longitude: point.longitude,
          ...(safeId(marker.id) !== undefined ? { id: safeId(marker.id) } : {}),
          ...(safeId(marker.userId) !== undefined ? { userId: safeId(marker.userId) } : {}),
          ...(safeId(marker.teamId) !== undefined ? { teamId: safeId(marker.teamId) } : {}),
        });
      } else if (data.type === 'viewportChange') {
        const viewport = data.viewport;
        const south = toNumber(viewport?.south);
        const north = toNumber(viewport?.north);
        const west = toNumber(viewport?.west);
        const east = toNumber(viewport?.east);
        const viewportZoom = toNumber(viewport?.zoom);
        if (Number.isFinite(viewportZoom)
          && isValidCoordinate(south, west) && isValidCoordinate(north, east)
          && south <= north && west <= east && viewportZoom >= 0 && viewportZoom <= 22) {
          onViewportChange?.({ south, north, west, east, zoom: viewportZoom });
        }
      }
    } catch (error) {
      // Ignore malformed messages from the WebView.
    }
  };

  const handleShouldStartLoadWithRequest = (request) => {
    if (request.url === 'about:blank') {
      return true;
    }

    if (request.url === OSM_ATTRIBUTION_URL) {
      Linking.openURL(OSM_ATTRIBUTION_URL).catch(() => {
        logEvent('map.attribution_open_failed', { error_code: 'open_url_failed' });
        Alert.alert('Atribusi peta tidak dapat dibuka', 'Periksa koneksi internet Anda.');
      });
    }

    return false;
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
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
