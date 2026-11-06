// Sales line and bar charts. In Arabic time runs right-to-left, like the dashboard.
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Path, Rect, Stop, Circle, Text as SvgText } from 'react-native-svg';
import { color, font } from '../lib/theme';
import type { Point } from '../lib/types';

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

export function SalesLine({ points, rtl, height = 96 }: { points: Point[]; rtl: boolean; height?: number }) {
  const [width, onLayout] = useWidth();
  const pts = points.length >= 2 ? points : [{ x: '', y: 0 }, ...points, ...(points.length ? [] : [{ x: '', y: 0 }])];
  const max = Math.max(0.001, ...pts.map((p) => p.y));
  const pad = 6;
  const coords = pts.map((p, k) => {
    let x = pad + (k / (pts.length - 1)) * (width - pad * 2);
    if (rtl) x = width - x;
    return [x, height - pad - (p.y / max) * (height - pad * 3)] as const;
  });
  // Smooth curve through the points (cardinal spline), so the line reads like a trend, not a zigzag.
  const d = coords.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = coords[i - 1];
    const cx = (px + x) / 2;
    return acc + ` C${cx},${py} ${cx},${y} ${x},${y}`;
  }, '');
  const [lx, ly] = coords[coords.length - 1] ?? [0, 0];
  const [fx] = coords[0] ?? [0, 0];
  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color.ink} stopOpacity={0.14} />
              <Stop offset="1" stopColor={color.ink} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Line x1={0} x2={width} y1={height - 2} y2={height - 2} stroke={color.line} strokeWidth={1} />
          <Path d={`${d} L${lx},${height - 2} L${fx},${height - 2} Z`} fill="url(#fill)" />
          <Path d={d} stroke={color.ink} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={lx} cy={ly} r={7} fill={color.ink} opacity={0.12} />
          <Circle cx={lx} cy={ly} r={3.5} fill={color.ink} />
        </Svg>
      )}
    </View>
  );
}

// Bars with the latest one dark and the peak labelled, as on the Numbers screen.
export function Bars({ points, rtl, label, value, height = 170 }: { points: Point[]; rtl: boolean; label: (p: Point, i: number) => string; value: (n: number) => string; height?: number }) {
  const [width, onLayout] = useWidth();
  const n = Math.max(1, points.length);
  const base = height - 26;
  const top = 18;
  const max = Math.max(0.001, ...points.map((p) => p.y));
  const peak = points.reduce((best, p, i) => (p.y > points[best].y ? i : best), 0);
  const slot = width / n;
  const bw = Math.max(4, Math.min(26, slot * 0.58));
  const every = Math.max(1, Math.ceil(n / 7));
  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {[base, (base + top) / 2, top].map((y, k) => <Line key={k} x1={0} x2={width} y1={y} y2={y} stroke={k ? color.lineSoft : color.line} strokeWidth={1} />)}
          {points.map((p, i) => {
            let cx = (i + 0.5) * slot;
            if (rtl) cx = width - cx;
            const bh = p.y > 0 ? Math.max(3, (p.y / max) * (base - top)) : 0;
            const last = i === n - 1;
            return (
              <G key={i}>
                <Rect x={cx - bw / 2} y={base - bh} width={bw} height={bh} rx={Math.min(5, bw / 2)} fill={last ? color.ink : i === peak ? color.inkSoft : color.bar} />
                {(i === peak || last) && p.y > 0 && <SvgText x={cx} y={Math.max(12, base - bh - 6)} fontSize={11} fontFamily={font.semibold} fill={color.ink} textAnchor="middle">{value(p.y)}</SvgText>}
                {(i % every === 0 || last) && <SvgText x={cx} y={height - 6} fontSize={11} fontFamily={last ? font.semibold : font.regular} fill={last ? color.ink : color.muted} textAnchor="middle">{label(p, i)}</SvgText>}
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

// Thin horizontal share bar used for "where the money went" and best sellers.
export function ShareBar({ pct, strong }: { pct: number; strong?: boolean }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: color.sunken, overflow: 'hidden', flex: 1 }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 6, borderRadius: 3, backgroundColor: strong ? color.green : color.inkSoft }} />
    </View>
  );
}
