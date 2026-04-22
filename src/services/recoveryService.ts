/**
 * RecoveryService
 * Manages IndexedDB persistence for audio chunks.
 * Ensures that recordings can be recovered after a crash.
 */

class RecoveryService {
  private dbName = 'SermonSyncRecorder';
  private storeName = 'chunks';
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Appends a chunk to the persistence layer.
   */
  async appendChunk(sessionId: string, blob: Blob) {
    const db = await this.getDB();
    const tx = db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    
    await new Promise((resolve, reject) => {
      const request = store.add({
        sessionId,
        blob,
        timestamp: Date.now()
      });
      request.onsuccess = resolve;
      request.onerror = reject;
    });
  }

  /**
   * Recovers all chunks for a session and reassembles them.
   */
  async recoverSession(sessionId: string): Promise<Blob | null> {
    const db = await this.getDB();
    const tx = db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result as any[];
        const filtered = all.filter(item => item.sessionId === sessionId)
                           .sort((a, b) => a.timestamp - b.timestamp);
        
        if (filtered.length === 0) {
          resolve(null);
          return;
        }

        const blobs = filtered.map(f => f.blob);
        resolve(new Blob(blobs, { type: 'audio/webm' }));
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Lists all unique session IDs currently in storage.
   */
  async listSessions(): Promise<string[]> {
    const db = await this.getDB();
    const tx = db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result as any[];
        const sessions = [...new Set(all.map(item => item.sessionId))];
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Deletes all chunks associated with a sessionId.
   */
  async clearSession(sessionId: string) {
    const db = await this.getDB();
    const tx = db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    
    const request = store.getAll();
    request.onsuccess = () => {
      const items = request.result as any[];
      items.forEach(item => {
        if (item.sessionId === sessionId) {
          store.delete(item.id);
        }
      });
    };
  }
}

export const recoveryService = new RecoveryService();
