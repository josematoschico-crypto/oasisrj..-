import { getFirebaseStorage } from '../firebase';

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 * @param file The file to upload.
 * @param path The path in the storage bucket (e.g., 'avatars/uid.png').
 * @returns A promise that resolves to the download URL.
 */
export const uploadFile = async (file: File | Blob, path: string): Promise<string> => {
  try {
    // Try client-side upload first
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const storage = await getFirebaseStorage();
    const storageRef = ref(storage, path);
    console.log(`[Storage] Attempting client-side upload to: ${path}`);
    const snapshot = await uploadBytes(storageRef, file);
    console.log(`[Storage] Client-side upload successful: ${path}`);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error: any) {
    console.error('[Storage] Client-side upload failed:', error);
    console.warn('[Storage] Falling back to server-side upload...');
    
    // Fallback to server-side upload
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, base64Data })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Server-side upload failed: ${errorData.details || errorData.error || response.statusText}`);
      }
      
      const { downloadURL } = await response.json();
      return downloadURL;
    } catch (fallbackError: any) {
      console.error('All upload methods failed:', fallbackError);
      throw fallbackError;
    }
  }
};

/**
 * Deletes a file from Firebase Storage.
 * @param path The path of the file to delete.
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const { ref, deleteObject } = await import('firebase/storage');
    const storage = await getFirebaseStorage();
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file from Firebase Storage:', error);
    throw error;
  }
};

/**
 * Helper to compress image before upload if needed.
 * This is a simple client-side compression using canvas.
 */
export const compressImage = (file: File, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.7): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas to Blob failed'));
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};
