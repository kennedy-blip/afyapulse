import { downloadFile } from './csv'

/**
 * Deliver an export on whatever platform we are running on.
 *
 * Web / PWA: a normal browser download.
 * Android APK: write into the app cache and open the native share sheet, which
 * is the only reliable way to hand a file to Files, email or WhatsApp from a
 * WebView. The Capacitor plugins are imported lazily so the web bundle does not
 * pay for them unless needed.
 */
export async function deliverExport({ filename, content, mime = 'text/plain;charset=utf-8', isNative = false, title = 'AfyaPulse export' }) {
  if (isNative) {
    try {
      const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
      ])
      const written = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true,
      })
      await Share.share({
        title,
        text: 'AfyaPulse offline export',
        url: written.uri,
        dialogTitle: title,
      })
      return 'shared'
    } catch {
      /* plugin unavailable (browser preview) — fall back to a download */
    }
  }

  downloadFile(filename, content, mime)
  return 'downloaded'
}
