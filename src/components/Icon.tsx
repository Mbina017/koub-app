// The dashboard's own line icons (koub_ui_icon), drawn with react-native-svg.
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color } from '../lib/theme';

const paths = {
  home: <Path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  orders: <><Path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><Path d="M4 8l8 4 8-4M12 12v8" /></>,
  products: <><Path d="M6 5h11v11a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" /><Path d="M17 8h1.5a2.5 2.5 0 0 1 0 5H17" /></>,
  numbers: <Path d="M5 20V11M10 20V5M15 20v-7M20 20V8" />,
  more: <><Circle cx="6" cy="12" r="1.3" /><Circle cx="12" cy="12" r="1.3" /><Circle cx="18" cy="12" r="1.3" /></>,
  back: <Path d="M5 12h14M13 6l6 6-6 6" />,
  chevron: <Path d="M15 6l-6 6 6 6" />,
  search: <><Circle cx="11" cy="11" r="6.5" /><Path d="M20 20l-4.2-4.2" /></>,
  whatsapp: <Path d="M4 19l1.4-4.2A8 8 0 1 1 9 18.6z" />,
  phone: <Path d="M6 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-2" />,
  copy: <><Rect x="8" y="8" width="12" height="12" rx="2" /><Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  pin: <><Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><Circle cx="12" cy="10" r="2.3" /></>,
  truck: <><Path d="M3 6h11v9H3z" /><Path d="M14 9h4l3 3v3h-7" /><Circle cx="7" cy="17.5" r="1.6" /><Circle cx="17" cy="17.5" r="1.6" /></>,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  bulb: <Path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  warn: <><Path d="M12 4l9 16H3z" /><Path d="M12 10v4M12 17v.01" /></>,
  users: <><Circle cx="9" cy="8" r="3.5" /><Path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3 6" /></>,
  lock: <><Rect x="5" y="10" width="14" height="10" rx="2" /><Path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  globe: <><Circle cx="12" cy="12" r="9" /><Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  bell: <><Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><Path d="M10 20a2 2 0 0 0 4 0" /></>,
  store: <Path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" />,
  gift: <><Rect x="4" y="9" width="16" height="11" rx="1" /><Path d="M4 13h16M12 9v11M12 9c-2-4-6-3-5 0M12 9c2-4 6-3 5 0" /></>,
  cash: <><Rect x="3" y="6" width="18" height="12" rx="2" /><Circle cx="12" cy="12" r="2.5" /></>,
  external: <Path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5" />,
  edit: <><Path d="M4 20h4L19 9l-4-4L4 16z" /><Path d="M13.5 6.5l4 4" /></>,
  logout: <><Path d="M10 5H5v14h5" /><Path d="M14 8l4 4-4 4M18 12H9" /></>,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  spark: <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />,
} as const;
export type IconName = keyof typeof paths;

// Direction icons are drawn for Arabic (back points right, "open" points left) and mirrored for English.
export function Icon({ name, size = 22, stroke = 1.7, tint = color.ink, rtl = true }: { name: IconName; size?: number; stroke?: number; tint?: string; rtl?: boolean }) {
  const flip = !rtl && (name === 'back' || name === 'chevron');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={tint} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      {paths[name]}
    </Svg>
  );
}
