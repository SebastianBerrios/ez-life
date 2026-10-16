"use client";

import { MotionConfig } from "framer-motion";
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}><MotionConfig reducedMotion="user">{children}</MotionConfig></NextThemesProvider>;
}
