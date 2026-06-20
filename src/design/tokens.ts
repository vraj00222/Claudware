/** Hardware Paper palette — the warm LIGHT system. Source of truth for inline styles, canvas, and r3f.
 *  Accent is the landing-page terracotta (#cc785c / hover #a9583e) — the brand color across the app. */
export const C = {
  canvas: "#E4DED2",
  surface: "#FBFAF6",
  inset: "#F0ECE3",
  border: "#C9C3B6",
  borderSub: "#DCD7CC",
  text: "#232019",
  text2: "#6E6A60",
  faint: "#A6A095",
  accent: "#cc785c",
  accentWeak: "#a9583e",
  warn: "#B26B07",
  warn2: "#B88416",
  error: "#C0271A",
  // viewport object tones
  objFill: "#E6E1D6",
  objBack: "#D6CFC2",
  layer: "#B9B2A4",
  viewportBg: "#ECE7DC",
  // accent chip (terracotta tint)
  chipBg: "#F6ECE6",
  chipBorder: "#E6CFC2",
  // amber episode
  amberGutterA: "#B26B07",
  amberGutterB: "#B88416",
  amberBg: "rgba(178,107,7,0.08)",
  // misc
  userBubble: "#DCD7CC",
  printBtnInk: "#ffffff",
} as const;

export const FONT = {
  sans: "'Bricolage Grotesque', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

/** Landing-page palette/fonts — used by NEW UI (Print Plan panel, etc.) per Vraj's design call:
 *  cream surfaces · terracotta accent · Newsreader headings + Inter body. */
export const LAND = {
  cream: "#faf9f5", surface: "#f5f0e8", card: "#f3efe6",
  ink: "#141413", ink2: "#3d3d3a", ink3: "#6c6a64", muted: "#8e8b82",
  border: "#e6dfd8", borderStrong: "#d8cfc2",
  accent: "#cc785c", accentHover: "#a9583e", selection: "#e8d8cf",
} as const;

export const LAND_FONT = {
  serif: "'Newsreader', Georgia, serif",
  sans: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;
