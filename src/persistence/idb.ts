import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'reconciler'
const DB_VERSION = 1

interface DbSchema {
  kv: { key: string; value: unknown }
  snapshots: { key: string; value: unknown; indexes: { 'by-period': string } }
  configs: { key: string; value: unknown }
  clients: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<DbSchema>> | null = null

function getDb(): Promise<IDBPDatabase<DbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
        if (!db.objectStoreNames.contains('configs')) db.createObjectStore('configs')
        if (!db.objectStoreNames.contains('clients')) db.createObjectStore('clients')
        if (!db.objectStoreNames.contains('snapshots')) {
          const store = db.createObjectStore('snapshots')
          store.createIndex('by-period', 'periodLabel')
        }
      },
    })
  }
  return dbPromise
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  return (await db.get('kv', key)) as T | undefined
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('kv', value, key)
}

export async function kvDelete(key: string): Promise<void> {
  const db = await getDb()
  await db.delete('kv', key)
}

export async function getAll<T>(store: 'configs' | 'clients' | 'snapshots'): Promise<T[]> {
  const db = await getDb()
  return (await db.getAll(store)) as T[]
}

export async function putRecord(
  store: 'configs' | 'clients' | 'snapshots',
  key: string,
  value: unknown,
): Promise<void> {
  const db = await getDb()
  await db.put(store, value, key)
}

export async function deleteRecord(
  store: 'configs' | 'clients' | 'snapshots',
  key: string,
): Promise<void> {
  const db = await getDb()
  await db.delete(store, key)
}

export async function clearAll(): Promise<void> {
  const db = await getDb()
  await Promise.all([
    db.clear('kv'),
    db.clear('configs'),
    db.clear('clients'),
    db.clear('snapshots'),
  ])
}

export function _resetDbForTests(): void {
  dbPromise = null
}
