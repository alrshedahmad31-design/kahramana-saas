/**
 * Kahramana Baghdad — Offline Sync Storage
 * Uses IndexedDB for persistent storage of financial actions (deliveries/handovers)
 * when the driver is offline. More robust than localStorage.
 */

const DB_NAME    = 'KahramanaOfflineDB'
const DB_VERSION = 1
const STORE_NAME = 'pending_actions'

export interface PendingAction {
  id?:             number
  orderId:         string
  currentStatus:   string
  metadata:        any
  timestamp:       number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror   = () => reject(request.error)
  })
}

export async function savePendingAction(action: Omit<PendingAction, 'id' | 'timestamp'>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.add({ ...action, timestamp: Date.now() })

    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.getAll()

    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function deletePendingAction(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.delete(id)

    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

export async function clearAllPendingActions(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.clear()

    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}
