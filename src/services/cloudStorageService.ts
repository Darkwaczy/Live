import { supabase } from './supabaseClient';

/**
 * CloudStorageService
 * Handles uploading sermon recordings to Supabase Storage.
 */

export interface UploadResult {
  success: boolean;
  path?: string;
  error?: string;
}

class CloudStorageService {
  private bucketName = 'sermons';

  /**
   * Uploads a sermon blob to Supabase Storage.
   * Path format: sermons/YYYY/MM/Sermon_YYYY-MM-DD_TITLE.webm
   */
  async uploadSermon(blob: Blob, title: string): Promise<UploadResult> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Clean title for filename
    const cleanTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'untitled';
    const fileName = `${year}-${month}-${day}_${cleanTitle}.webm`;
    const filePath = `${year}/${month}/${fileName}`;

    try {
      console.log(`[CloudStorage] Uploading to ${this.bucketName}/${filePath}...`);
      
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'audio/webm'
        });

      if (error) {
        console.error('[CloudStorage] Upload failed:', error);
        return { success: false, error: error.message };
      }

      console.log('[CloudStorage] Upload successful:', data.path);
      return { success: true, path: data.path };
    } catch (err: any) {
      console.error('[CloudStorage] Unexpected error:', err);
      return { success: false, error: err.message || 'Unknown error' };
    }
  }

  /**
   * Generates a signed URL for a recorded sermon (expires in 1 hour)
   */
  async getSermonUrl(path: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .createSignedUrl(path, 3600);

      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      console.error('[CloudStorage] Error getting signed URL:', err);
      return null;
    }
  }
}

export const cloudStorageService = new CloudStorageService();
