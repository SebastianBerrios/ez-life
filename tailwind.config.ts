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
        sans: ["var(--font-figtree)", "ui-sans-serif", "system-ui", "sans-serif"],
        figtree: ["var(--font-figtree)", "ui-sans-serif", "system-ui", "sans-serif"],
        fredoka: ["var(--font-fredoka)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-fredoka)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-hero": ["44px", { lineHeight: "52px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "display-hero-mobile": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-lg": ["30px", { lineHeight: "38px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-md": ["20px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-sm": ["16px", { lineHeight: "24px", letterSpacing: "-0.005em", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", letterSpacing: "0em", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", letterSpacing: "0em", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "16px", letterSpacing: "0em", fontWeight: "400" }],
        "metric-num-lg": ["36px", { lineHeight: "44px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "metric-num-md": ["22px", { lineHeight: "28px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0em", fontWeight: "500" }],
        "label-xs": ["11px", { lineHeight: "14px", letterSpacing: "0em", fontWeight: "500" }],
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
        "pill-needs": {
          DEFAULT: token("pill-needs"),
          foreground: token("pill-needs-foreground"),
        },
        "pill-wants": {
          DEFAULT: token("pill-wants"),
          foreground: token("pill-wants-foreground"),
        },
        "pill-savings": {
          DEFAULT: token("pill-savings"),
          foreground: token("pill-savings-foreground"),
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "1.5rem",
        card: "var(--radius)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        dialog: "var(--shadow-dialog)",
        focus: "0 0 0 2px hsl(var(--ring)), 0 0 0 4px hsl(var(--ring) / 0.2)",
        "focus-destructive": "0 0 0 2px hsl(var(--destructive)), 0 0 0 4px hsl(var(--destructive) / 0.2)",
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
        "fade-slide-up": "fade-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
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
