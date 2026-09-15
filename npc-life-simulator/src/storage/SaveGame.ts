import type { SaveData } from './serialize';

const DB_NAME = 'npc-life-simulator';
const DB_VERSION = 1;
const STORE = 'saves';

export interface SaveSlotInfo {
  id: string;
  name: string;
  savedAt: number;
  cityName: string;
  population: number;
  day: number;
  seed: number;
}

interface StoredSave extends SaveSlotInfo {
  data: SaveData;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB konnte nicht geöffnet werden.'));
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = fn(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Speicherzugriff fehlgeschlagen.'));
        transaction.oncomplete = () => db.close();
      }),
  );
}

/** Persists a world. Save files stay entirely on the player's machine. */
export async function saveGame(id: string, name: string, data: SaveData): Promise<SaveSlotInfo> {
  const info: SaveSlotInfo = {
    id,
    name,
    savedAt: Date.now(),
    cityName: data.config.cityName,
    population: (data.npcs as { alive?: boolean }[]).filter((n) => n.alive).length,
    day: Math.floor(data.clock.totalMinutes / 1440),
    seed: data.config.seed,
  };
  await tx('readwrite', (store) => store.put({ ...info, data } as StoredSave));
  return info;
}

export async function listSaves(): Promise<SaveSlotInfo[]> {
  try {
    const all = await tx<StoredSave[]>('readonly', (store) => store.getAll() as IDBRequest<StoredSave[]>);
    return all
      .map(({ data: _data, ...info }) => info)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function loadGame(id: string): Promise<SaveData | null> {
  const row = await tx<StoredSave | undefined>(
    'readonly',
    (store) => store.get(id) as IDBRequest<StoredSave | undefined>,
  );
  return row?.data ?? null;
}

export async function deleteSave(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>);
}

/** Name of the slot the game writes to when the player hits "Speichern". */
export const QUICK_SLOT = 'quicksave';
