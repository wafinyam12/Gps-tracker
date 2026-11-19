const stateKey = (ownerId) => `visit_active:${ownerId}`;
const samplesKey = (ownerId) => `visit_samples:${ownerId}`;

const readJson = async (storage, key, fallback) => {
  const raw = await storage.getItem(key);
  if (raw === null) return fallback;
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Data lokasi kunjungan tidak valid.');
  return value;
};

const visitKey = ({ serverVisitId, localVisitId }) => (
  serverVisitId ? `server:${serverVisitId}` : `local:${localVisitId}`
);

const toSample = (location, createUuid) => {
  if (location?.coords?.latitude == null || location?.coords?.longitude == null
    || location?.coords?.accuracy == null || location?.timestamp == null) return null;
  const latitude = Number(location?.coords?.latitude);
  const longitude = Number(location?.coords?.longitude);
  const accuracy = Number(location?.coords?.accuracy);
  const timestamp = Number(location?.timestamp);
  if (location?.mocked || !Number.isFinite(latitude) || Math.abs(latitude) > 90
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180
    || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 300
    || !Number.isFinite(timestamp)) return null;

  return {
    client_uuid: createUuid(), latitude, longitude, accuracy,
    recorded_at: new Date(timestamp).toISOString(), is_mock_location: false,
  };
};

export const visitTrackingOptions = (active) => active
  ? { accuracy: 'high', timeInterval: 60000, distanceInterval: 0 }
  : { accuracy: 'balanced', timeInterval: 300000, distanceInterval: 50 };

export const createVisitSampleQueue = ({ storage, send, resolveVisitId, createUuid }) => {
  let mutation = Promise.resolve();
  const serial = (operation) => {
    const run = mutation.then(operation, operation);
    mutation = run.catch(() => {});
    return run;
  };

  const append = async (ownerId, state, location) => {
    const sample = toSample(location, createUuid);
    if (!sample) return false;
    if (state.startedAt && Date.parse(sample.recorded_at) < Date.parse(state.startedAt)) return false;
    const records = await readJson(storage, samplesKey(ownerId), []);
    const record = records.find((item) => item.key === state.key);
    if (!record) throw new Error('Antrean lokasi kunjungan hilang.');
    record.samples.push(sample);
    await storage.setItem(samplesKey(ownerId), JSON.stringify(records));
    return true;
  };

  return {
    activeVisit: (ownerId) => readJson(storage, stateKey(ownerId), null),

    begin: (ownerId, identity) => serial(async () => {
      if (!identity?.serverVisitId && !identity?.localVisitId) throw new Error('ID kunjungan belum tersedia.');
      const state = { ...identity, key: visitKey(identity) };
      const records = await readJson(storage, samplesKey(ownerId), []);
      if (!records.some((item) => item.key === state.key)) {
        records.push({ ...state, samples: [], finalRequested: false });
        await storage.setItem(samplesKey(ownerId), JSON.stringify(records));
      }
      await storage.setItem(stateKey(ownerId), JSON.stringify(state));
      return state;
    }),

    capture: (ownerId, location) => serial(async () => {
      const state = await readJson(storage, stateKey(ownerId), null);
      return state ? append(ownerId, state, location) : false;
    }),

    finish: (ownerId, location = null) => serial(async () => {
      const state = await readJson(storage, stateKey(ownerId), null);
      if (!state) return false;
      if (location) await append(ownerId, state, location);
      const records = await readJson(storage, samplesKey(ownerId), []);
      const record = records.find((item) => item.key === state.key);
      if (record) {
        if (location && Number.isFinite(Number(location.timestamp))) {
          const cutoff = Number(location.timestamp);
          record.samples = record.samples.filter((sample) => Date.parse(sample.recorded_at) <= cutoff);
        }
        record.finalRequested = true;
      }
      await storage.setItem(samplesKey(ownerId), JSON.stringify(records));
      await storage.removeItem(stateKey(ownerId));
      return true;
    }),

    cancel: (ownerId) => serial(async () => {
      const state = await readJson(storage, stateKey(ownerId), null);
      if (!state) return;
      const records = await readJson(storage, samplesKey(ownerId), []);
      await storage.setItem(samplesKey(ownerId), JSON.stringify(records.filter((item) => item.key !== state.key)));
      await storage.removeItem(stateKey(ownerId));
    }),

    flush: (ownerId, force = false) => serial(async () => {
      const records = await readJson(storage, samplesKey(ownerId), []);
      let sent = 0;
      for (const record of [...records]) {
        const serverVisitId = record.serverVisitId || await resolveVisitId(record.localVisitId, ownerId);
        if (!serverVisitId) continue;
        while (record.samples.length >= 5 || (force && record.samples.length > 0)
          || (record.finalRequested && record.samples.length >= 0)) {
          const batch = record.samples.slice(0, 100);
          const finalBatch = record.finalRequested && record.samples.length <= 100;
          await send(serverVisitId, { samples: batch, final_batch: finalBatch }, ownerId);
          record.samples.splice(0, batch.length);
          sent += batch.length;
          if (finalBatch) {
            const index = records.findIndex((item) => item.key === record.key);
            if (index !== -1) records.splice(index, 1);
            break;
          }
          await storage.setItem(samplesKey(ownerId), JSON.stringify(records));
          if (record.samples.length === 0) break;
        }
      }
      await storage.setItem(samplesKey(ownerId), JSON.stringify(records));
      return sent;
    }),
  };
};
