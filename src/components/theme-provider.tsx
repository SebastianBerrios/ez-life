"use client";

import { MotionConfig } from "framer-motion";
import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme, type ThemeProviderProps } from "next-themes";

const LIGHT_THEME_COLOR = "#FBF5EA";
const DARK_THEME_COLOR = "#241A2B";

function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (!resolvedTheme) return;
    const color = resolvedTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-dynamic="true"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.setAttribute("data-dynamic", "true");
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColorSync />
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}
