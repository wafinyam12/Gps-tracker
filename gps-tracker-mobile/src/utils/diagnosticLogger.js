import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import appJson from '../../app.json';

const LOG_PREFIX = 'diagnostic-';
const MAX_FILE_BYTES = 16 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;
const RETENTION_DAYS = 7;
const SAFE_FIELDS = new Set([
  'action', 'operation', 'method', 'path', 'status', 'duration_ms', 'error_code',
  'result', 'queue_size', 'retry_count', 'processed', 'attempt', 'platform', 'app_version',
  'app_build', 'request_id', 'request_id_mismatch', 'permission', 'source',
]);

let writeQueue = Promise.resolve();

const logDirectory = () => (FileSystem.documentDirectory ? `${FileSystem.documentDirectory}diagnostic-logs/` : null);

const sanitizePath = (value) => {
  if (typeof value !== 'string') return undefined;
  const path = value.split('?')[0].split('#')[0].slice(0, 240);
  const resourceNames = new Set(['users', 'teams', 'visits', 'stores', 'customers', 'branches', 'cash-payments']);
  const segments = path.replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ':id').split('/');
  return segments.map((segment, index) => {
    if (index > 0 && resourceNames.has(segments[index - 1]) && segment) return ':id';
    if (/^\d+$/.test(segment)) return ':id';
    return segment.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 64);
  }).join('/');
};

const sanitizeField = (key, value) => {
  if (!SAFE_FIELDS.has(key) || value === undefined || value === null) return undefined;
  if (key === 'path') return sanitizePath(value);
  if (key === 'request_id') return typeof value === 'string' ? value.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64) : undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  if (key === 'method') return /^[A-Z]{3,10}$/.test(value) ? value : undefined;
  if (key === 'error_code' || key === 'action' || key === 'operation') {
    return /^[A-Za-z0-9._-]{1,80}$/.test(value) ? value : undefined;
  }
  if (key === 'permission') return ['foreground', 'background', 'media_library'].includes(value) ? value : undefined;
  if (key === 'result') return /^[A-Za-z0-9._-]{1,32}$/.test(value) ? value : undefined;
  if (key === 'source') return /^[A-Za-z0-9._-]{1,32}$/.test(value) ? value : undefined;
  if (key === 'app_version' || key === 'app_build' || key === 'platform') {
    return /^[A-Za-z0-9._-]{1,32}$/.test(value) ? value : undefined;
  }
  return undefined;
};

const currentBuildInfo = () => ({
  platform: Platform.OS,
  app_version: appJson.expo?.version || appJson.version,
  app_build: Platform.OS === 'ios' ? appJson.expo?.ios?.buildNumber : appJson.expo?.android?.versionCode,
});

const getLogFiles = async (directory) => {
  const names = await FileSystem.readDirectoryAsync(directory);
  const records = await Promise.all(names
    .filter((name) => name.startsWith(LOG_PREFIX) && name.endsWith('.jsonl'))
    .map(async (name) => {
      const uri = `${directory}${name}`;
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists ? { name, uri, size: info.size || 0, modificationTime: info.modificationTime || 0 } : null;
    }));
  return records.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
};

const pruneLogs = async (directory, files) => {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let total = files.reduce((sum, file) => sum + file.size, 0);
  for (const file of files) {
    if (file.modificationTime * 1000 < cutoff || total > MAX_TOTAL_BYTES) {
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
      total -= file.size;
    }
  }
};

const appendLine = async (line) => {
  const directory = logDirectory();
  if (!directory) return;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  let files = await getLogFiles(directory);
  await pruneLogs(directory, files);
  files = await getLogFiles(directory);
  const latest = files[files.length - 1];
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayIndexes = files
    .filter((file) => file.name.startsWith(`${LOG_PREFIX}${date}-`))
    .map((file) => Number(file.name.slice(`${LOG_PREFIX}${date}-`.length, -'.jsonl'.length)))
    .filter(Number.isFinite);
  const nextIndex = Math.max(0, ...todayIndexes) + 1;
  const fileName = latest?.name.startsWith(`${LOG_PREFIX}${date}-`) && latest.size + line.length <= MAX_FILE_BYTES
    ? latest.name
    : `${LOG_PREFIX}${date}-${String(nextIndex).padStart(4, '0')}.jsonl`;
  const fileUri = `${directory}${fileName}`;
  const existing = latest?.name === fileName ? await FileSystem.readAsStringAsync(fileUri) : '';
  await FileSystem.writeAsStringAsync(fileUri, `${existing}${line}`);
  files = await getLogFiles(directory);
  await pruneLogs(directory, files);
};

const enqueue = (operation) => {
  writeQueue = writeQueue.then(operation, operation).catch(() => {});
  return writeQueue;
};

export const createRequestId = () => {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const logEvent = (event, metadata = {}) => enqueue(async () => {
  const safeMetadata = Object.fromEntries(Object.entries(metadata).flatMap(([key, value]) => {
    const safeValue = sanitizeField(key, value);
    return safeValue === undefined ? [] : [[key, safeValue]];
  }));
  const entry = { timestamp: new Date().toISOString(), event: String(event).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80), ...currentBuildInfo(), ...safeMetadata };
  await appendLine(`${JSON.stringify(entry)}\n`);
});

export const logApiOutcome = (metadata) => logEvent('api.request.completed', metadata);

export const readDiagnosticLogs = async () => {
  try {
    const directory = logDirectory();
    if (!directory) return '';
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const files = await getLogFiles(directory);
    await pruneLogs(directory, files);
    const retained = await getLogFiles(directory);
    return (await Promise.all(retained.map((file) => FileSystem.readAsStringAsync(file.uri)))).join('');
  } catch (error) {
    return '';
  }
};
