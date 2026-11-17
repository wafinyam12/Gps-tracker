import assert from 'node:assert/strict';
import test from 'node:test';

const theme = await import('../src/styles/visitTheme.js').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

const luminance = (hex) => {
  const rgb = hex.match(/[0-9a-f]{2}/gi)?.map((part) => parseInt(part, 16) / 255);
  if (!rgb || rgb.length !== 3) return 0;
  const channels = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (foreground, background) => {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

test('visit action and status text remain legible on their surfaces', () => {
  const colors = theme.visitColors || {};
  for (const [foreground, background] of [
    [colors.surface, colors.primary],
    [colors.ink, colors.canvas],
    [colors.mutedInk, colors.surface],
    [colors.success, colors.successTint],
    [colors.warning, colors.warningTint],
    [colors.danger, colors.dangerTint],
  ]) {
    assert.ok(foreground && background, 'visit palette must provide every foreground and surface');
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} must meet 4.5:1`);
  }
});
