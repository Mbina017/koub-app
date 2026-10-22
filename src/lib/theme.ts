// KOUB design tokens. Same palette as the web dashboard (admin-ui.css), tuned for native.
export const color = {
  bg: '#F7F3EC',
  surface: '#FFFFFF',
  sunken: '#EFE8DD',
  ink: '#2B241D',
  inkSoft: '#4A4038',
  muted: '#6B6157',
  faint: '#9A8F83',
  line: '#E7DFD3',
  lineSoft: '#F1EBE2',
  bar: '#B7AEA3',
  green: '#2F6B4F',
  greenBg: '#E6F0EA',
  amber: '#9A5B13',
  amberBg: '#F8EBD8',
  red: '#A8322B',
  redBg: '#F7E3E0',
  blue: '#2D5A86',
  blueBg: '#E3ECF5',
  overlay: 'rgba(43,36,29,0.42)',
} as const;

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'muted' | 'neutral';
export const tone: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: color.green, bg: color.greenBg },
  amber: { fg: color.amber, bg: color.amberBg },
  red: { fg: color.red, bg: color.redBg },
  blue: { fg: color.blue, bg: color.blueBg },
  muted: { fg: color.muted, bg: color.sunken },
  neutral: { fg: color.inkSoft, bg: color.sunken },
};

export const font = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
  brand: 'CormorantGaramond_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const shadow = {
  card: {
    shadowColor: '#2B241D',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  float: {
    shadowColor: '#2B241D',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;
