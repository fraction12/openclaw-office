interface ZoneLabelProps {
  zone: { x: number; y: number; width: number; height: number; label: string };
}

export function ZoneLabel({ zone }: ZoneLabelProps) {
  return (
    <text
      x={zone.x + 16}
      y={zone.y + 24}
      fill="#64748b"
      fontSize={13}
      fontWeight={500}
    >
      {zone.label}
    </text>
  );
}
