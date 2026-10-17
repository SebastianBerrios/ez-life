import type { Config } from "tailwindcss";

// Colors are HSL triplets in src/app/globals.css; `<alpha-value>` enables `bg-primary/10` etc.
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/presentation/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular", "monospace"],
        // Alias kept so existing `font-heading` classes keep working (now Geist, no serif).
        heading: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-hero": ["44px", { lineHeight: "52px", letterSpacing: "-0.03em", fontWeight: "600" }],
        "display-hero-mobile": ["32px", { lineHeight: "40px", letterSpacing: "-0.025em", fontWeight: "600" }],
        "headline-lg": ["30px", { lineHeight: "38px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-md": ["20px", { lineHeight: "28px", letterSpacing: "-0.015em", fontWeight: "500" }],
        "headline-sm": ["16px", { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "500" }],
        "body-lg": ["16px", { lineHeight: "24px", letterSpacing: "-0.005em", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", letterSpacing: "0em", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.005em", fontWeight: "400" }],
        "metric-num-lg": ["36px", { lineHeight: "44px", letterSpacing: "-0.03em", fontWeight: "600" }],
        "metric-num-md": ["22px", { lineHeight: "28px", letterSpacing: "-0.02em", fontWeight: "500" }],
        "label-mono-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "500" }],
        "label-mono-xs": ["10px", { lineHeight: "12px", letterSpacing: "0.06em", fontWeight: "400" }],
      },
      colors: {
        border: {
          DEFAULT: token("border"),
          strong: token("border-strong"),
        },
        input: token("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        "surface-2": token("surface-2"),
        "surface-3": token("surface-3"),
        success: token("success"),
        expense: token("expense"),
        subtle: token("subtle"),
        primary: {
          DEFAULT: token("primary"),
          hover: token("primary-hover"),
          foreground: token("primary-foreground"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        warning: {
          DEFAULT: token("warning"),
          foreground: token("warning-foreground"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        popover: {
          DEFAULT: token("popover"),
          foreground: token("popover-foreground"),
        },
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },
      },
      // 4px badges/kbd, 8px buttons/inputs/cards, 12px dialogs/sheets. No soft shadows.
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "12px",
      },
      boxShadow: {
        // Only deliberate shadows: the deep dialog/sheet layer and the emerald focus glow.
        dialog: "0 20px 40px -10px rgb(0 0 0 / 0.8)",
        focus: "0 0 0 1px hsl(var(--primary)), 0 0 12px hsl(var(--primary) / 0.15)",
        "focus-destructive": "0 0 0 1px hsl(var(--destructive)), 0 0 12px hsl(var(--destructive) / 0.15)",
      },
      keyframes: {
        "fade-slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "overlay-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // `from`-only keyframes: the end state is the element's own transform (centering-safe).
        "sheet-in": {
          from: { transform: "translateY(100%)" },
        },
        "sheet-fade-in": {
          from: { opacity: "0" },
        },
      },
      animation: {
        "fade-slide-up": "fade-slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both",
        "overlay-in": "overlay-in 0.15s ease-out both",
        "sheet-in": "sheet-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
        "sheet-fade-in": "sheet-fade-in 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
