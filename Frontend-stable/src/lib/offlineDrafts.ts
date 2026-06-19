const DB_NAME = "jalankita-drafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

export interface DraftPhoto {
  blob: Blob;
  thumbnail?: string;
}

export interface OfflineDraft {
  id?: number;
  createdAt: string;
  updatedAt: string;
  roadName: string;
  district: string;
  date: string;
  panjang: string;
  lebar: string;
  catatan: string;
  latitude: number | null;
  longitude: number | null;
  roadNameSource: string | null;
  photos: DraftPhoto[];
  isBatch: boolean;
  savedOffline?: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function generateThumbnail(blob: Blob, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
      } else {
        if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(""); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve("");
    img.src = URL.createObjectURL(blob);
  });
}

function compressImage(blob: Blob, maxWidth = 1200, quality = 0.7): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) { h = h * maxWidth / w; w = maxWidth; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(blob); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((compressed) => {
        resolve(compressed || blob);
      }, "image/jpeg", quality);
    };
    img.onerror = () => resolve(blob);
    img.src = URL.createObjectURL(blob);
  });
}

export async function saveDraft(
  data: Omit<OfflineDraft, "id" | "createdAt" | "updatedAt" | "photos"> & { photos: Blob[] },
): Promise<number> {
  const db = await openDB();
  const photos: DraftPhoto[] = [];
  for (const blob of data.photos) {
    const compressed = await compressImage(blob);
    const thumbnail = await generateThumbnail(compressed);
    photos.push({ blob: compressed, thumbnail });
  }
  const draft: OfflineDraft = {
    ...data,
    photos,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).add(draft);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function listDrafts(): Promise<OfflineDraft[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const drafts = (req.result as OfflineDraft[]).reverse();
      resolve(drafts);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getDraft(id: number): Promise<OfflineDraft | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as OfflineDraft | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDraft(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getDraftCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
