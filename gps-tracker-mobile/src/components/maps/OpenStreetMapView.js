import React, { useMemo } from 'react';
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

const buildMapHtml = ({
  center,
  markers,
  circles,
  polyline,
  zoom,
}) => {
  const payload = {
    tileUrl: OSM_TILE_URL,
    attribution: OSM_ATTRIBUTION,
    center,
    markers,
    circles,
    polyline,
    zoom,
  };

  return `<!doctype html>
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
    .leaflet-control-attribution {
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const payload = ${safeJson(payload)};
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([payload.center.latitude, payload.center.longitude], payload.zoom);

    L.tileLayer(payload.tileUrl, {
      maxZoom: 19,
      attribution: '&copy; ' + payload.attribution
    }).addTo(map);

    const bounds = [];
    const escapeHtml = (value) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    const postMarkerPress = (marker) => {
      try {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'markerPress',
          marker
        }));
      } catch (error) {}
    };

    payload.markers.forEach((marker) => {
      const markerIcon = L.divIcon({
        className: '',
        html: '<div class="marker-dot" style="background:' + marker.color + '"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
      });

      const leafletMarker = L.marker([marker.latitude, marker.longitude], { icon: markerIcon })
        .addTo(map)
        .bindPopup(
          '<div class="popup-title">' + escapeHtml(marker.title || 'Lokasi') + '</div>' +
          '<div class="popup-copy">' + escapeHtml(marker.description || '') + '</div>'
        );

      leafletMarker.on('click', () => postMarkerPress(marker));
      bounds.push([marker.latitude, marker.longitude]);
    });

    payload.circles.forEach((circle) => {
      L.circle([circle.latitude, circle.longitude], {
        radius: circle.radius,
        color: circle.strokeColor,
        fillColor: circle.fillColor,
        fillOpacity: 0.22,
        weight: 2
      }).addTo(map);
      bounds.push([circle.latitude, circle.longitude]);
    });

    if (payload.polyline.length > 1) {
      const line = payload.polyline.map((point) => [point.latitude, point.longitude]);
      L.polyline(line, {
        color: '#0F766E',
        weight: 4,
        opacity: 0.82
      }).addTo(map);
      line.forEach((point) => bounds.push(point));
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], Math.max(payload.zoom, 15));
    }
  </script>
</body>
</html>`;
};

const OpenStreetMapView = ({
  style,
  center = DEFAULT_CENTER,
  markers = [],
  circles = [],
  polyline = [],
  zoom = 13,
  onMarkerPress,
}) => {
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
  const html = useMemo(
    () => buildMapHtml({
      center: normalizedCenter,
      markers: normalizedMarkers,
      circles: normalizedCircles,
      polyline: normalizedPolyline,
      zoom,
    }),
    [normalizedCenter, normalizedMarkers, normalizedCircles, normalizedPolyline, zoom]
  );

  const handleMessage = (event) => {
    if (!onMarkerPress) {
      return;
    }

    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'markerPress') {
        onMarkerPress(data.marker);
      }
    } catch (error) {
      // Ignore malformed messages from the WebView.
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
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
