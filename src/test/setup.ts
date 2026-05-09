import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { resetDbForTests } from '../db/schema';

afterEach(async () => {
  resetDbForTests();
  const dbs = (await indexedDB.databases?.()) ?? [];
  await Promise.all(
    dbs.map(
      (info) =>
        new Promise<void>((resolve) => {
          if (!info.name) return resolve();
          const req = indexedDB.deleteDatabase(info.name);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        }),
    ),
  );
});
