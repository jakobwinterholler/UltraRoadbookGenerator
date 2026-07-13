import L from "leaflet";

export function zoneMapDivIcon(options: {
  fillColor: string;
  selected: boolean;
  dimmed: boolean;
  verified: boolean;
}): L.DivIcon {
  const size = options.selected ? 16 : 12;
  const checkBadge = options.verified
    ? `<span style="position:absolute;top:-4px;right:-5px;width:11px;height:11px;border-radius:9999px;background:#10b981;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:700;line-height:1;box-shadow:0 1px 2px rgba(0,0,0,0.18)">✓</span>`
    : "";

  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px"><div style="width:100%;height:100%;border-radius:9999px;background:${options.fillColor};border:2px solid #fff;opacity:${options.dimmed ? 0.28 : 0.92};box-shadow:0 1px 3px rgba(0,0,0,0.18)"></div>${checkBadge}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
