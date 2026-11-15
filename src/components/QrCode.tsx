// A QR code drawn as one SVG path (qrcode-generator, plain JS: works in Expo Go and on the web).
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

export function QrCode({ value, size = 220, color = '#2B241D', bg = '#FFFFFF' }: { value: string; size?: number; color?: string; bg?: string }) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) path += `M${c + 2} ${r + 2}h1v1h-1z`;
    return { d: path, n: count + 4 }; // a quiet zone of 2 modules on each side
  }, [value]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
      <Rect x={0} y={0} width={n} height={n} fill={bg} />
      <Path d={d} fill={color} />
    </Svg>
  );
}
