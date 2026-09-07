import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { offlineQueue } from './offlineQueue';

export const OFFLINE_SYNC_TASK = 'sales-daily-offline-visit-sync';

if (!TaskManager.isTaskDefined(OFFLINE_SYNC_TASK)) {
  TaskManager.defineTask(OFFLINE_SYNC_TASK, async () => {
    try {
      await offlineQueue.processQueue({ silent: true });
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.error('Background offline sync failed:', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export const registerOfflineSyncTask = async () => {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      return false;
    }

    const registered = await TaskManager.isTaskRegisteredAsync(OFFLINE_SYNC_TASK);
    if (!registered) {
      await BackgroundTask.registerTaskAsync(OFFLINE_SYNC_TASK, {
        minimumInterval: 15,
      });
    }

    return true;
  } catch (error) {
    console.log('Unable to register offline sync background task:', error?.message || error);
    return false;
  }
};
