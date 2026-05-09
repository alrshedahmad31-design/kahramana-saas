/**
 * Kahramana Baghdad — Offline Sync Storage
 * Uses IndexedDB for persistent storage of:
 *   1. Driver delivery actions (deliveries / handovers) when offline
 *   2. POS orders submitted while offline — flushed on reconnect with the
 *      same idempotency key so retries return the existing order_id.
 */

const DB_NAME    = 'KahramanaOfflineDB'
const DB_VERSION = 2

const STORE_ACTIONS    = 'pending_actions'
const STORE_POS_ORDERS = 'pending_pos_orders'

// ── Driver actions ────────────────────────────────────────────────────────────

export interface PendingAction {
  id?:           number
  orderId:       string
  currentStatus: string
  metadata:      Record<string, unknown> | null
  timestamp:     number
}

// ── POS orders ────────────────────────────────────────────────────────────────

/**
 * Snapshot of a POS order awaiting submission. The `idempotencyKey` is
 * client-generated so flush retries are server-deduped via
 * `rpc_create_order`'s idempotency guard.
 */
export interface PendingPosOrder {
  id?:             number
  idempotencyKey:  string                       // UUID
  payload:         Record<string, unknown>      // ManualOrderPayload + idempotencyKey
  timestamp:       number
}

// ── Connection ────────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const oldVersion = event.oldVersion ?? 0

      if (!db.objectStoreNames.contains(STORE_ACTIONS)) {
        db.createObjectStore(STORE_ACTIONS, { keyPath: 'id', autoIncrement: true })
      }

      if (oldVersion < 2 && !db.objectStoreNames.contains(STORE_POS_ORDERS)) {
        const store = db.createObjectStore(STORE_POS_ORDERS, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror   = () => reject(request.error)
  })
}

// ── Driver-action helpers (existing surface — unchanged) ──────────────────────

export async function savePendingAction(
  action: Omit<PendingAction, 'id' | 'timestamp'>,
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_ACTIONS, 'readwrite')
    const store = tx.objectStore(STORE_ACTIONS)
    const req   = store.add({ ...action, timestamp: Date.now() })
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_ACTIONS, 'readonly')
    const store = tx.objectStore(STORE_ACTIONS)
    const req   = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function deletePendingAction(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_ACTIONS, 'readwrite')
    const store = tx.objectStore(STORE_ACTIONS)
    const req   = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

export async function clearAllPendingActions(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_ACTIONS, 'readwrite')
    const store = tx.objectStore(STORE_ACTIONS)
    const req   = store.clear()
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ── POS-order queue helpers ───────────────────────────────────────────────────

export async function enqueuePosOrder(
  entry: Omit<PendingPosOrder, 'id' | 'timestamp'>,
): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_POS_ORDERS, 'readwrite')
    const store = tx.objectStore(STORE_POS_ORDERS)
    const req   = store.add({ ...entry, timestamp: Date.now() })
    req.onsuccess = () => resolve(req.result as number)
    req.onerror   = () => reject(req.error)
  })
}

export async function getPendingPosOrders(): Promise<PendingPosOrder[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_POS_ORDERS, 'readonly')
    const store = tx.objectStore(STORE_POS_ORDERS)
    const req   = store.getAll()
    req.onsuccess = () => resolve(req.result as PendingPosOrder[])
    req.onerror   = () => reject(req.error)
  })
}

export async function pendingPosOrderCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_POS_ORDERS, 'readonly')
    const store = tx.objectStore(STORE_POS_ORDERS)
    const req   = store.count()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function deletePendingPosOrder(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_POS_ORDERS, 'readwrite')
    const store = tx.objectStore(STORE_POS_ORDERS)
    const req   = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}
