interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strength: number;
}

export function ConnectionLine({
  x1,
  y1,
  x2,
  y2,
  strength,
}: ConnectionLineProps) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="#60a5fa"
      strokeWidth={1.5}
      strokeDasharray="6,4"
      opacity={Math.max(0.1, strength)}
      style={{
        animation: "dash-flow 2s linear infinite",
      }}
    />
  );
}
