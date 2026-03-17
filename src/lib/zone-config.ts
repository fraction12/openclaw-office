/**
 * Data-driven zone/layout configuration.
 * Zones are defined here as config objects — FloorPlan and spatial logic
 * read from this config instead of hardcoded constants.
 *
 * To customize layout: modify the default config or provide an override via settings.
 */

export interface ZoneConfig {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  colorDark: string;
  /** Zone purpose drives spatial placement logic */
  purpose: "desk" | "hotDesk" | "meeting" | "lounge" | "corridor";
}

export interface OfficeLayoutConfig {
  svgWidth: number;
  svgHeight: number;
  wallThickness: number;
  cornerRadius: number;
  corridorWidth: number;
  wallColor: string;
  wallColorDark: string;
  corridorColor: string;
  corridorColorDark: string;
  zones: ZoneConfig[];
}

export interface OfficeFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Build the default 4-zone office layout.
 * This matches the original hardcoded OFFICE/ZONES constants.
 */
export function createDefaultLayout(): OfficeLayoutConfig {
  const svgWidth = 1200;
  const svgHeight = 700;
  const officeX = 30;
  const officeY = 20;
  const officeWidth = svgWidth - 60;
  const officeHeight = svgHeight - 40;
  const corridorWidth = 28;

  const halfW = (officeWidth - corridorWidth) / 2;
  const halfH = (officeHeight - corridorWidth) / 2;
  const rightX = officeX + halfW + corridorWidth;
  const bottomY = officeY + halfH + corridorWidth;

  return {
    svgWidth,
    svgHeight,
    wallThickness: 6,
    cornerRadius: 18,
    corridorWidth,
    wallColor: "#8b9bb0",
    wallColorDark: "#475569",
    corridorColor: "#e8ecf1",
    corridorColorDark: "#0f172a",
    zones: [
      {
        id: "desk",
        label: "Main Office",
        x: officeX,
        y: officeY,
        width: halfW,
        height: halfH,
        color: "#f4f6f9",
        colorDark: "#1e293b",
        purpose: "desk",
      },
      {
        id: "meeting",
        label: "Meeting Room",
        x: rightX,
        y: officeY,
        width: halfW,
        height: halfH,
        color: "#eef3fa",
        colorDark: "#1a2744",
        purpose: "meeting",
      },
      {
        id: "hotDesk",
        label: "Subagent Desks",
        x: officeX,
        y: bottomY,
        width: halfW,
        height: halfH,
        color: "#f1f3f7",
        colorDark: "#1e2433",
        purpose: "hotDesk",
      },
      {
        id: "lounge",
        label: "Lounge",
        x: rightX,
        y: bottomY,
        width: halfW,
        height: halfH,
        color: "#f3f1f7",
        colorDark: "#231e33",
        purpose: "lounge",
      },
    ],
  };
}

export function getOfficeFrame(layout: OfficeLayoutConfig): OfficeFrame {
  const x = 30;
  const y = 20;
  return {
    x,
    y,
    width: layout.svgWidth - 60,
    height: layout.svgHeight - 40,
  };
}

/** Resolve a zone by purpose from a layout config */
export function getZoneByPurpose(
  layout: OfficeLayoutConfig,
  purpose: ZoneConfig["purpose"],
): ZoneConfig | undefined {
  return layout.zones.find((z) => z.purpose === purpose);
}

/** Get zone rect (for compatibility with old ZONES[key] shape) */
export function getZoneRect(zone: ZoneConfig): { x: number; y: number; width: number; height: number } {
  return { x: zone.x, y: zone.y, width: zone.width, height: zone.height };
}

/** Compute the corridor entrance point from layout */
export function getCorridorEntrance(layout: OfficeLayoutConfig): { x: number; y: number } {
  const office = getOfficeFrame(layout);
  return {
    x: office.x + office.width / 2,
    y: office.y + office.height - 30,
  };
}

/** Compute the corridor center crossing point */
export function getCorridorCenter(layout: OfficeLayoutConfig): { x: number; y: number } {
  const office = getOfficeFrame(layout);
  return {
    x: office.x + office.width / 2,
    y: office.y + office.height / 2,
  };
}

export function getZoneDoorPoint(
  layout: OfficeLayoutConfig,
  purpose: ZoneConfig["purpose"],
): { x: number; y: number } {
  if (purpose === "corridor") {
    return getCorridorEntrance(layout);
  }

  const zone = getZoneByPurpose(layout, purpose);
  if (!zone) {
    return getCorridorEntrance(layout);
  }

  const corridorHalf = layout.corridorWidth / 2;
  switch (purpose) {
    case "desk":
    case "meeting":
      return { x: zone.x + zone.width / 2, y: zone.y + zone.height + corridorHalf };
    case "hotDesk":
    case "lounge":
      return { x: zone.x + zone.width / 2, y: zone.y - corridorHalf };
  }
}

/** The current active layout — default singleton, can be replaced */
let activeLayout: OfficeLayoutConfig = createDefaultLayout();

export function getActiveLayout(): OfficeLayoutConfig {
  return activeLayout;
}

export function setActiveLayout(layout: OfficeLayoutConfig): void {
  activeLayout = layout;
}
