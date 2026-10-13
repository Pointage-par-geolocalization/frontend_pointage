// src/components/MapLayers.tsx
// Fonds de carte partagés (Plan / Satellite / Hybride) avec sélecteur de calques.
// À placer à l'intérieur d'un <MapContainer>. Aucune clé API requise.
import { LayersControl, LayerGroup, TileLayer } from "react-leaflet"

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services"
const ESRI_ATTR = "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"

export default function MapLayers() {
  return (
    <LayersControl position="topright" collapsed={false}>
      <LayersControl.BaseLayer checked name="Plan">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>

      <LayersControl.BaseLayer name="Satellite">
        <TileLayer attribution={ESRI_ATTR} url={`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`} maxZoom={19} />
      </LayersControl.BaseLayer>

      <LayersControl.BaseLayer name="Hybride">
        <LayerGroup>
          <TileLayer attribution={ESRI_ATTR} url={`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`} maxZoom={19} />
          <TileLayer url={`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`} maxZoom={19} />
          <TileLayer url={`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`} maxZoom={19} />
        </LayerGroup>
      </LayersControl.BaseLayer>
    </LayersControl>
  )
}
