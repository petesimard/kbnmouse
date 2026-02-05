import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'kiosk-imagegen';
const STORE_NAME = 'images';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

export function useImageStorage() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadImages = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by createdAt descending (newest first)
        const sorted = request.result.sort((a, b) => b.createdAt - a.createdAt);
        setImages(sorted);
        setLoading(false);
      };

      request.onerror = () => {
        console.error('Failed to load images:', request.error);
        setLoading(false);
      };
    } catch (err) {
      console.error('Failed to open database:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const saveImage = useCallback(async (prompt, imageData) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const image = {
        prompt,
        imageData,
        createdAt: Date.now(),
      };

      return new Promise((resolve, reject) => {
        const request = store.add(image);
        request.onsuccess = () => {
          const newImage = { ...image, id: request.result };
          setImages(prev => [newImage, ...prev]);
          resolve(newImage);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Failed to save image:', err);
      throw err;
    }
  }, []);

  const deleteImage = useCallback(async (id) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => {
          setImages(prev => prev.filter(img => img.id !== id));
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Failed to delete image:', err);
      throw err;
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          setImages([]);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Failed to clear images:', err);
      throw err;
    }
  }, []);

  return { images, loading, saveImage, deleteImage, clearAll };
}
