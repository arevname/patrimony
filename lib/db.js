import Dexie from 'dexie';

const db = new Dexie('PatrimonyDB');
db.version(1).stores({ store: 'key' });

export const storage = {
  get: async (key) => {
    try {
      const item = await db.store.get(key);
      return item ? { key, value: item.value } : null;
    } catch { return null; }
  },
  set: async (key, value) => {
    await db.store.put({ key, value });
    return { key, value };
  },
  delete: async (key) => {
    await db.store.delete(key);
    return { key, deleted: true };
  },
  list: async (prefix) => {
    const all = await db.store.toArray();
    const keys = prefix
      ? all.filter(i => i.key.startsWith(prefix)).map(i => i.key)
      : all.map(i => i.key);
    return { keys };
  },
};
