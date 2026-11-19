import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Leaflet WebView script defines marker color sanitizer in its own scope', () => {
  const source = readFileSync(new URL('../src/components/maps/OpenStreetMapView.js', import.meta.url), 'utf8');
  const browserScript = source.slice(source.indexOf('  <script>'), source.indexOf('  </script>'));
  const declaration = browserScript.indexOf('const safeColor =');
  const usage = browserScript.indexOf('safeColor(marker.color');
  assert.ok(declaration > 0, 'WebView must define safeColor; the React Native helper is not available there');
  assert.ok(usage > declaration, 'safeColor must be defined before the marker renderer uses it');
});
