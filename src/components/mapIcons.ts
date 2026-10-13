// src/components/mapIcons.ts
// Marqueurs colorés via divIcon (pas d'assets PNG de Leaflet, qui se cassent avec Vite).
import L from "leaflet"

function dot(color: string, size = 16) {
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 2px ${color}"></div>`,
  })
}

export const entryIcon = dot("#16a34a")
export const exitIcon = dot("#dc2626")
export const workplaceIcon = dot("#2563eb", 14)

/** Épingle classique pour le sélecteur de position. */
export const pinIcon = L.divIcon({
  className: "",
  iconSize: [28, 38],
  iconAnchor: [14, 38],
  html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.3 0 0 6.2 0 13.8 0 24 14 38 14 38s14-14 14-24.2C28 6.2 21.7 0 14 0z" fill="#2563eb" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`,
})
