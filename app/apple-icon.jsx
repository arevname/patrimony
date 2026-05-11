import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%', height: '100%',
        background: '#0F0E0C',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ color: '#C9A961', fontSize: 110, fontWeight: 300, lineHeight: 1 }}>
        P
      </div>
    </div>,
    { ...size }
  );
}
