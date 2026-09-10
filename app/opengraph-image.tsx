import { ImageResponse } from 'next/og';

export const alt = 'EasyDispatch — AI-first HVAC field service management';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px',
          backgroundColor: '#f2f5f8',
          backgroundImage:
            'radial-gradient(900px 480px at 8% -10%, #d9efff 0%, transparent 55%), radial-gradient(700px 400px at 100% 0%, #e4e9ee 0%, transparent 50%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              backgroundColor: '#1a222b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#59bbff',
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            ED
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: '#1a222b',
              letterSpacing: '-0.03em',
            }}
          >
            EasyDispatch
          </div>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 52,
            fontWeight: 650,
            color: '#1a222b',
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            maxWidth: 920,
          }}
        >
          AI-first HVAC field service management
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 26,
            color: '#455a70',
            maxWidth: 820,
            lineHeight: 1.4,
          }}
        >
          Office dispatch and a technician run sheet — live on the web today.
        </div>
      </div>
    ),
    { ...size }
  );
}
