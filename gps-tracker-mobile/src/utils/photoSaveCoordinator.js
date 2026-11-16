export const createPhotoSaveCoordinator = (cleanup) => {
  let saving = null;
  let releaseSaving = null;
  let leaveAllowed = false;

  return {
    begin() {
      if (saving) return false;
      saving = new Promise((resolve) => { releaseSaving = resolve; });
      leaveAllowed = false;
      return true;
    },
    finish() {
      if (releaseSaving) releaseSaving();
      saving = null;
      releaseSaving = null;
      leaveAllowed = false;
    },
    allowLeave() { leaveAllowed = true; },
    isSaving() { return saving !== null; },
    canLeave() { return saving === null || leaveAllowed; },
    async cleanupWhenSafe(uris) {
      const activeSave = saving;
      if (activeSave) await activeSave;
      return cleanup(uris);
    },
  };
};
