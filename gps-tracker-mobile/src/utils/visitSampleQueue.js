import apiClient from '../api/client';
import { secureOfflineVisitStorage } from './secureOfflineVisitStorage';
import { OFFLINE_VISIT_MAP_KEY } from './offlineDataMigration';
import { offlineQueue } from './offlineQueue';
import { createVisitSampleQueue } from './visitSampleQueueCore';

export const visitSampleQueue = createVisitSampleQueue({
  storage: secureOfflineVisitStorage,
  createUuid: offlineQueue.createUuid,
  resolveVisitId: async (localVisitId, ownerUserId) => {
    if (!localVisitId) return null;
    const raw = await secureOfflineVisitStorage.getItem(OFFLINE_VISIT_MAP_KEY);
    const mapping = raw ? JSON.parse(raw)[localVisitId] : null;
    if (!mapping || (typeof mapping === 'object' && String(mapping.ownerUserId) !== String(ownerUserId))) {
      return null;
    }
    return typeof mapping === 'object' ? mapping.visitLogId : mapping;
  },
  send: (visitLogId, payload, ownerUserId) => apiClient.post(
    `/visits/${visitLogId}/samples`, payload,
    { offlineOwnerUserId: ownerUserId },
  ),
});
