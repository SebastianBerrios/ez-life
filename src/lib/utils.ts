import { createCn } from "cn/config"

/** Typography scale from tailwind.config.ts (spec 010). */
const TEXT_SCALE = [
  "display-hero",
  "display-hero-mobile",
  "headline-lg",
  "headline-lg-mobile",
  "headline-md",
  "headline-sm",
  "body-lg",
  "body-md",
  "body-sm",
  "metric-num-lg",
  "metric-num-md",
  "label-mono-sm",
  "label-mono-xs",
]

/**
 * Class merger registered with the design-system tokens. Without this, the merge engine reads
 * `text-headline-md` / `text-label-mono-sm` as a text COLOR and drops (or is dropped by) a real
 * color such as `text-foreground`, and `shadow-focus` as a shadow color.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: TEXT_SCALE }],
      shadow: [{ shadow: ["dialog", "focus", "focus-destructive"] }],
    },
  },
})
