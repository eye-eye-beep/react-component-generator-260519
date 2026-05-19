import { useState } from 'react';
import { LiveProvider, LivePreview as ReactLivePreview, LiveError } from 'react-live';

interface LivePreviewProps {
  code: string;
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT_WIDTHS: Record<ViewportSize, string> = {
  mobile: '375px',
  tablet: '768px',
  desktop: '100%',
};

const VIEWPORT_LABELS: Record<ViewportSize, string> = {
  mobile: '📱 모바일',
  tablet: '📊 태블릿',
  desktop: '🖥️ 데스크탑',
};

export function LivePreview({ code }: LivePreviewProps) {
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

  return (
    <div className="preview-panel">
      <div className="panel-header">
        <h3>미리보기</h3>
        <div className="viewport-controls">
          {(Object.keys(VIEWPORT_LABELS) as ViewportSize[]).map((size) => (
            <button
              key={size}
              className={`btn-viewport ${viewport === size ? 'btn-viewport--active' : ''}`}
              onClick={() => setViewport(size)}
              title={VIEWPORT_LABELS[size]}
              aria-label={VIEWPORT_LABELS[size]}
            >
              {VIEWPORT_LABELS[size]}
            </button>
          ))}
        </div>
      </div>
      <div className="preview-content">
        <div className="preview-wrapper" style={{ width: VIEWPORT_WIDTHS[viewport] }}>
          <LiveProvider code={code} noInline>
            <div className="preview-render">
              <ReactLivePreview />
            </div>
            <LiveError className="preview-error" />
          </LiveProvider>
        </div>
      </div>
    </div>
  );
}
