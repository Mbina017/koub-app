// Ask before a step, with the store's own wording. Alert buttons don't exist on the web preview, so it uses the browser's dialogs.
import { Alert, Platform } from 'react-native';

export function confirmStep(a: { label: string; confirm: string; tone: string }, back: string, run: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(a.confirm)) run(); return; }
  Alert.alert(a.label, a.confirm, [{ text: back, style: 'cancel' }, { text: a.label, style: a.tone === 'danger' ? 'destructive' : 'default', onPress: run }]);
}

export function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(title + '\n' + message); else Alert.alert(title, message);
}
