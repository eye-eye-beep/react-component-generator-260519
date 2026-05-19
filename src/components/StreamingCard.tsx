interface StreamingCardProps {
  prompt: string;
  streamingCode: string;
}

export function StreamingCard({ prompt, streamingCode }: StreamingCardProps) {
  return (
    <div className="component-card component-card--streaming">
      <div className="card-header">
        <div className="card-title-group">
          <span className="streaming-badge">생성 중...</span>
          <p className="card-prompt">{prompt}</p>
        </div>
      </div>
      <div className="card-tabs">
        <button className="tab tab--active" disabled>코드</button>
        <button className="tab tab--disabled" disabled>미리보기 (생성 완료 후)</button>
      </div>
      <div className="card-content">
        <div className="code-panel">
          <pre className="code-block streaming-code-block">
            <code>{streamingCode}<span className="streaming-cursor" aria-hidden="true">▋</span></code>
          </pre>
        </div>
      </div>
    </div>
  );
}
