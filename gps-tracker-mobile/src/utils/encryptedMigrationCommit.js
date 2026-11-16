// SQLCipher keys are connection-scoped. Expo SDK 54's exclusive transaction
// creates a fresh connection, so migration must use the already keyed one.
export const commitEncryptedMigration = async (database, entries, markerKey, markerValue, writeValue) => {
  await database.withTransactionAsync(async () => {
    for (const entry of entries) {
      await writeValue(database, entry.key, entry.value);
    }
    await writeValue(database, markerKey, markerValue);
  });
};
