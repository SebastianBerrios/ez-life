"use client";

import { MotionConfig } from "framer-motion";
import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

// `enableSystem` is off (spec 010): a stored "system" value (from before the redesign) would
// resolve to no class at all, so it is treated as the dark default and rewritten.
function SystemThemeReset() {
  const { theme, setTheme } = useTheme();
  React.useEffect(() => {
    if (theme === "system") setTheme("dark");
  }, [theme, setTheme]);
  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <SystemThemeReset />
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}
