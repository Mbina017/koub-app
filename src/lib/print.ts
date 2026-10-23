// Shipping slips: the store renders them exactly as the dashboard prints them. The phone turns them into a PDF
// named after the order and opens the share sheet with a preview: WhatsApp, Print, Save to Files.
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { api, type Session } from './api';

export async function shareSlips(session: Session, ids: number[], name: string) {
  const { html } = await api.slips(session, ids);
  await sharePdf(html, name);
}

// Any page the app prints (the slips, the delivery run): a PDF named for what it is, then the share sheet.
export async function sharePdf(html: string, name: string, size: { width: number; height: number } = { width: 595, height: 842 }) {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
    return;
  }
  // A4 by default, the size the slip is designed for; receipts pass a till-roll size.
  const { uri } = await Print.printToFileAsync({ html, ...size });
  let file = uri;
  try {
    const to = FileSystem.cacheDirectory + name + '.pdf';
    await FileSystem.deleteAsync(to, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to });
    file = to;
  } catch { /* keep the generated name */ }
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
  else await Print.printAsync({ uri: file });
}
