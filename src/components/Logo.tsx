import { Image } from 'expo-image';
import { LOGO_RATIO } from '../lib/logoData';

// The KOUB logo (new brand mark with "CARRY YOUR STORY"). Use this anywhere the brand name is shown, never typed text.
export function Logo({ width = 160, center = false }: { width?: number; center?: boolean }) {
  return (
    <Image
      source={require('../../assets/logo.png')}
      style={{ width, height: Math.round(width / LOGO_RATIO), alignSelf: center ? 'center' : 'flex-start' }}
      contentFit="contain"
      accessibilityLabel="KOUB"
    />
  );
}
