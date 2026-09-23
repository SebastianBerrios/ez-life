import { ImageResponse } from 'next/og';

// Open Graph preview image (FR-003) — generated with Next.js App Router's
// native `opengraph-image` file convention instead of a static image file,
// since no designed logo asset exists yet (spec.md Assumptions defers visual
// design). Next.js serves this automatically and wires it into the page's
// metadata without any manual URL configuration (research.md §4). Zero new
// dependencies — `next/og` ships with Next.js (Principio VII).
//
// `runtime = 'edge'` is required here: the Node.js runtime's `@vercel/og`
// asset resolution throws `TypeError: Invalid URL` during `next build` on
// Windows (confirmed while building this feature), because it resolves its
// default font via `fileURLToPath(new URL(...))` in a way that breaks on
// Windows paths. The edge runtime uses a different, working resolution path.
export const runtime = 'edge';
export const alt = 'ez-life';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          background: 'hsl(38, 30%, 96%)',
        }}
      >
        <span style={{ fontSize: 120 }}>🌿</span>
        <span
          style={{
            fontSize: 88,
            fontWeight: 800,
            color: 'hsl(25, 25%, 15%)',
          }}
        >
          ez-life
        </span>
        <span style={{ fontSize: 36, color: 'hsl(155, 38%, 40%)' }}>
          Tu finanzas, sin complicaciones.
        </span>
      </div>
    ),
    { ...size }
  );
}
