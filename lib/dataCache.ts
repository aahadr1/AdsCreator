'use client';

// IndexedDB-based cache for instant data loading
const DB_NAME = 'AdsCreatorCache';
const STORE_NAME = 'userData';
const DB_VERSION = 1;

interface CachedData {
  userId: string;
  tasks: any[];
  user: any;
  credits: any;
  timestamp: number;
}

class DataCache {
  private db: IDBDatabase | null = null;
  
  async init() {
    if (this.db) return;
    
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
        }
      };
    });
  }
  
  async get(userId: string): Promise<CachedData | null> {
    await this.init();
    if (!this.db) return null;
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(userId);
      
      request.onsuccess = () => {
        const data = request.result;
        // Cache valid for 5 minutes
        if (data && Date.now() - data.timestamp < 5 * 60 * 1000) {
          resolve(data);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => resolve(null);
    });
  }
  
  async set(data: CachedData): Promise<void> {
    await this.init();
    if (!this.db) return;
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(data);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }
}

export const dataCache = new DataCache();

// Prefetch and cache user data
export async function prefetchUserData(userId: string): Promise<CachedData | null> {
  // Check cache first
  const cached = await dataCache.get(userId);
  if (cached) return cached;
  
  // Fetch fresh data
  try {
    const response = await fetch(`/api/user/prefetch?user_id=${encodeURIComponent(userId)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const cacheData = {
      userId,
      ...data,
      timestamp: Date.now()
    };
    
    // Cache for next time
    await dataCache.set(cacheData);
    
    return cacheData;
  } catch {
    return null;
  }
}
