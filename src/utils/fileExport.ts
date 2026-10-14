import { AppData } from '../types';

// In-memory cache for the last selected file handle during the session
let cachedFileHandle: any = null;

/**
 * Checks if the browser supports the File System Access API (showSaveFilePicker).
 * Supported in modern desktop Chrome, Edge, Opera, and Brave.
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

export interface SaveJsonResult {
  success: boolean;
  method: 'filesystem' | 'download' | 'cancelled';
  fileName: string;
  handle?: any;
  message: string;
}

/**
 * Saves or exports JSON with the option to directly overwrite an existing file.
 *
 * Why standard downloads increment numbers (e.g. "league_schedule (1).json"):
 * Standard browser downloads (via <a download>) are sandboxed for security to prevent
 * unauthorized file modification. Browsers automatically append numbers when a file
 * with the same name exists in your Downloads directory.
 *
 * How this function enables overwriting:
 * When preferOverwrite is true (and the browser supports File System Access API):
 * 1. It invokes `window.showSaveFilePicker()`.
 * 2. If the user selects an existing file (e.g. league_schedule.json), the browser's
 *    native dialog asks "league_schedule.json already exists. Do you want to replace it?".
 * 3. Upon confirmation, it writes directly into that file in-place, overwriting it
 *    without any incremented numbers or duplicate files!
 * 4. The file handle is retained for quick subsequent saves during this session.
 */
export async function saveOrExportJson(
  data: AppData | any,
  defaultFileName: string,
  options?: {
    preferOverwrite?: boolean;
    reuseHandle?: boolean;
    customHandle?: any;
  }
): Promise<SaveJsonResult> {
  const { preferOverwrite = true, reuseHandle = false, customHandle = null } = options || {};

  const cleanName = defaultFileName.trim().endsWith('.json')
    ? defaultFileName.trim()
    : `${defaultFileName.trim()}.json`;

  const jsonString = JSON.stringify(data, null, 2);

  // Try File System Access API if requested and supported
  if (preferOverwrite && isFileSystemAccessSupported()) {
    try {
      let handle = customHandle || (reuseHandle ? cachedFileHandle : null);

      if (!handle) {
        handle = await (window as any).showSaveFilePicker({
          suggestedName: cleanName,
          types: [
            {
              description: 'JSON Data File',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
      }

      if (handle) {
        cachedFileHandle = handle;
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();

        const savedName = handle.name || cleanName;
        return {
          success: true,
          method: 'filesystem',
          fileName: savedName,
          handle,
          message: `Directly saved and replaced "${savedName}" (no duplicate copies created).`,
        };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          method: 'cancelled',
          fileName: cleanName,
          message: 'Save operation was cancelled.',
        };
      }
      // If permission was denied or other error occurred, fallback to standard download below
      console.warn('File System Access API failed, falling back to download:', err);
    }
  }

  // Fallback: Standard browser download via Blob URL
  try {
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      method: 'download',
      fileName: cleanName,
      message: `Downloaded as "${cleanName}". Note: If an identical file exists in your Downloads folder, your browser may append a number like (1).`,
    };
  } catch (err: any) {
    return {
      success: false,
      method: 'download',
      fileName: cleanName,
      message: `Failed to export file: ${err.message || 'Unknown error'}`,
    };
  }
}

/**
 * Resets any cached file handle so the user can choose a new target location.
 */
export function resetCachedFileHandle() {
  cachedFileHandle = null;
}
