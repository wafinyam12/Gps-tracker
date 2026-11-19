import assert from 'node:assert/strict';
import test from 'node:test';
import { createVisitSampleQueue, visitTrackingOptions } from '../src/utils/visitSampleQueueCore.js';

const makeQueue = () => {
  const values = new Map();
  const sent = [];
  let fail = false;
  let mappedId = null;
  let nextUuid = 0;
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
  const queue = createVisitSampleQueue({
    storage,
    createUuid: () => `12345678-1234-4123-8123-${String(++nextUuid).padStart(12, '0')}`,
    resolveVisitId: async () => mappedId,
    send: async (id, payload) => {
      if (fail) throw new Error('network failed');
      sent.push({ id, payload });
    },
  });
  return { queue, values, sent, setFail: (value) => { fail = value; }, setMappedId: (id) => { mappedId = id; } };
};

const point = (minute) => ({
  coords: { latitude: -6.2, longitude: 106.8, accuracy: 10 },
  timestamp: Date.parse(`2026-11-17T09:${String(minute).padStart(2, '0')}:00+07:00`),
  mocked: false,
});

test('visit mode requests one-minute high accuracy; general mode requests five-minute balanced', () => {
  assert.deepEqual(visitTrackingOptions(true), { accuracy: 'high', timeInterval: 60000, distanceInterval: 0 });
  assert.deepEqual(visitTrackingOptions(false), { accuracy: 'balanced', timeInterval: 300000, distanceInterval: 50 });
});

test('sample is saved before send, survives network failure, and final batch replays once', async () => {
  const { queue, values, sent, setFail } = makeQueue();
  await queue.begin('7', { serverVisitId: 55 });
  await queue.capture('7', point(0));
  await queue.capture('7', point(1));
  assert.ok(values.get('visit_samples:7')?.includes('latitude'));
  setFail(true);
  await queue.finish('7', point(2));
  await assert.rejects(queue.flush('7', true), /network failed/);
  assert.equal(sent.length, 0);
  assert.ok(values.get('visit_samples:7')?.includes('latitude'));

  setFail(false);
  await queue.flush('7', true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].id, 55);
  assert.equal(sent[0].payload.samples.length, 3);
  assert.equal(sent[0].payload.final_batch, true);
  await queue.flush('7', true);
  assert.equal(sent.length, 1);
});

test('offline local visit waits for server mapping and different user cannot flush it', async () => {
  const { queue, sent, setMappedId } = makeQueue();
  await queue.begin('7', { localVisitId: 'local-1' });
  await queue.capture('7', point(0));
  await queue.finish('7', point(1));
  await queue.flush('8', true);
  await queue.flush('7', true);
  assert.equal(sent.length, 0);
  setMappedId(84);
  await queue.flush('7', true);
  assert.equal(sent[0].id, 84);
});

test('batch upload caps request at 100 points and finalizes only the last batch', async () => {
  const { queue, sent } = makeQueue();
  await queue.begin('7', { serverVisitId: 55 });
  for (let i = 0; i < 101; i++) await queue.capture('7', point(i % 60));
  await queue.finish('7');
  await queue.flush('7', true);
  assert.deepEqual(sent.map((item) => item.payload.samples.length), [100, 1]);
  assert.deepEqual(sent.map((item) => item.payload.final_batch), [false, true]);
});

test('samples captured after the checkout GPS timestamp are not uploaded', async () => {
  const { queue, sent } = makeQueue();
  await queue.begin('7', { serverVisitId: 55 });
  await queue.capture('7', point(0));
  await queue.capture('7', point(3));
  await queue.finish('7', point(2));
  await queue.flush('7', true);
  assert.deepEqual(sent[0].payload.samples.map((sample) => sample.recorded_at), [
    new Date(point(0).timestamp).toISOString(),
    new Date(point(2).timestamp).toISOString(),
  ]);
});

test('cached background points from before check-in are ignored', async () => {
  const { queue, sent } = makeQueue();
  await queue.begin('7', { serverVisitId: 55, startedAt: new Date(point(2).timestamp).toISOString() });
  assert.equal(await queue.capture('7', point(1)), false);
  await queue.capture('7', point(2));
  await queue.finish('7', point(3));
  await queue.flush('7', true);
  assert.equal(sent[0].payload.samples.length, 2);
});

test('missing GPS accuracy is not recorded as an exact sample', async () => {
  const { queue, sent } = makeQueue();
  await queue.begin('7', { serverVisitId: 55 });
  assert.equal(await queue.capture('7', { ...point(1), coords: { ...point(1).coords, accuracy: null } }), false);
  assert.equal(await queue.capture('7', { ...point(1), coords: { ...point(1).coords, latitude: null } }), false);
  assert.equal(await queue.capture('7', { ...point(1), coords: { ...point(1).coords, longitude: null } }), false);
  await queue.finish('7');
  await queue.flush('7', true);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].payload, { samples: [], final_batch: true });
});
