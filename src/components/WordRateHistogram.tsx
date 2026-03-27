interface WordRatePoint {
  second: number;
  words: number;
  confidence?: number;
}

interface WordRateHistogramProps {
  data: WordRatePoint[];
}

const WordRateHistogram: React.FC<WordRateHistogramProps> = ({ data }) => {
  const maxWords = data.length ? Math.max(...data.map((d) => d.words)) : 1;

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return '#46c2ff';
    if (confidence >= 0.9) return '#10b981';
    if (confidence >= 0.7) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="panel" style={{ minHeight: 180 }}>
      <header>Live Word Rate & Confidence (last 30s)</header>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100, marginBottom: 8 }}>
        {data.length === 0 && <span>No data yet</span>}
        {data.map((point) => {
          const height = maxWords === 0 ? 0 : (point.words / maxWords) * 100;
          const color = getConfidenceColor(point.confidence);
          return (
            <div
              key={point.second}
              style={{
                width: 12,
                height: `${height}%`,
                background: color,
                borderRadius: 2,
                opacity: 0.8,
                transition: 'all 0.2s'
              }}
              title={`${point.words} words · ${((point.confidence ?? 1) * 100).toFixed(0)}% confidence`}
              onMouseEnter={(e) => {
                (e.target as HTMLDivElement).style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLDivElement).style.opacity = '0.8';
              }}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
        <span>🟢 High (90%+)</span>
        <span>🟡 Medium (70-90%)</span>
        <span>🔴 Low (&lt;70%)</span>
      </div>
      <div style={{ fontSize: 10, marginTop: 6, display: 'flex', gap: 12 }}>
        {data.slice(-5).map((point) => (
          <span key={point.second}>
            {new Date(point.second * 1000).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
          </span>
        ))}
      </div>
    </div>
  );
};

export default WordRateHistogram;
