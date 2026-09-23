import { ImageResponse } from 'next/og';

// Favicon (FR-001, FR-002) — generated with Next.js App Router's native
// `icon` file convention instead of a static image file, since no designed
// logo asset exists yet (spec.md Assumptions defers visual design). Renders
// the app's only existing brand mark (the leaf emoji next to "ez-life" in
// LoginScreen.tsx) on the app's primary brand color. Zero new dependencies —
// `next/og` ships with Next.js (Principio VII).
//
// `runtime = 'edge'` is required here: the Node.js runtime's `@vercel/og`
// asset resolution throws `TypeError: Invalid URL` during `next build` on
// Windows (confirmed while building this feature), because it resolves its
// default font via `fileURLToPath(new URL(...))` in a way that breaks on
// Windows paths. The edge runtime uses a different, working resolution path.
export const runtime = 'edge';
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'hsl(155, 38%, 40%)',
          borderRadius: '20%',
        }}
      >
        <span style={{ fontSize: 22 }}>🌿</span>
      </div>
    ),
    { ...size }
  );
}
