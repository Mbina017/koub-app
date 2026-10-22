// Shipping slips: the store renders them exactly as the dashboard prints them; the phone opens its print sheet (AirPrint / Android printing, or Save as PDF).
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import { api, type Session } from './api';

export async function printSlips(session: Session, ids: number[]) {
  const { html } = await api.slips(session, ids);
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
    return;
  }
  await Print.printAsync({ html });
}
