export interface ColorPair {
  primary: string;
  secondary: string;
}

export const CLUB_COLOR_PALETTE: ColorPair[] = [
  { primary: '#c1272d', secondary: '#ffffff' },
  { primary: '#c1272d', secondary: '#f5d300' },
  { primary: '#c1272d', secondary: '#1a1a1a' },
  { primary: '#005ca0', secondary: '#ffffff' },
  { primary: '#005ca0', secondary: '#f5d300' },
  { primary: '#1a1206', secondary: '#f5d300' },
  { primary: '#1a1a1a', secondary: '#ffd700' },
  { primary: '#ffffff', secondary: '#005ca0' },
  { primary: '#3fa860', secondary: '#ffffff' },
  { primary: '#3fa860', secondary: '#1a1a1a' },
  { primary: '#ff8200', secondary: '#1a1a1a' },
  { primary: '#5b8af5', secondary: '#ffffff' },
  { primary: '#9c27b0', secondary: '#ffd700' },
  { primary: '#7b3f00', secondary: '#ffd700' },
  { primary: '#003366', secondary: '#e0a855' },
  { primary: '#0e6e3e', secondary: '#ffffff' },
  { primary: '#4b1e58', secondary: '#a0a0a0' },
  { primary: '#1a1a1a', secondary: '#ffffff' },
  { primary: '#7a0019', secondary: '#ffd700' },
  { primary: '#003f87', secondary: '#e05555' },
  { primary: '#88913f', secondary: '#1a1a1a' },
  { primary: '#a83434', secondary: '#1a1206' },
];

export function randomColorPair(): ColorPair {
  const idx = Math.floor(Math.random() * CLUB_COLOR_PALETTE.length);
  const safe = CLUB_COLOR_PALETTE[idx] ?? CLUB_COLOR_PALETTE[0]!;
  return { ...safe };
}
