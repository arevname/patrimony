import { ImageResponse } from 'next/og';

export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%', height: '100%',
        background: '#0F0E0C',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '42px',
      }}
    >
      <div style={{
        color: '#C9A961',
        fontSize: 120,
        fontWeight: 300,
        letterSpacing: '-4px',
        lineHeight: 1,
      }}>
        P
      </div>
    </div>,
    { ...size }
  );
}
