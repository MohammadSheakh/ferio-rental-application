'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapMarker } from '@/lib/api';

/**
 * Solid-black price chip marker — product-card chip style (§6):
 * no color, no shadow; the price is the information.
 * §23: promoted listings carry a ★ prefix (still grayscale).
 */
function priceIcon(price: number, promoted?: boolean): L.DivIcon {
  const label =
    price >= 10_000_000
      ? `৳${(price / 10_000_000).toFixed(1)}Cr`
      : price >= 100_000
        ? `৳${(price / 100_000).toFixed(1)}L`
        : `৳${Math.round(price / 1000)}k`;
  return L.divIcon({
    className: 'ferio-price-chip',
    html: `<span>${promoted ? '★ ' : ''}${label}</span>`,
    iconSize: promoted ? [74, 24] : [64, 24],
    iconAnchor: promoted ? [37, 12] : [32, 12],
  });
}

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Reports viewport changes so the parent can refetch markers. */
function ViewportTracker({ onChange }: { onChange: (b: Bounds) => void }) {
  const map = useMap();
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    const report = () => {
      const b = map.getBounds();
      cbRef.current({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      });
    };
    report();
    map.on('moveend', report);
    return () => {
      map.off('moveend', report);
    };
  }, [map]);

  return null;
}

export interface FerioMapProps {
  center: [number, number];
  zoom?: number;
  markers: MapMarker[];
  onBoundsChange?: (b: Bounds) => void;
}

export default function FerioMap({ center, zoom = 12, markers, onBoundsChange }: FerioMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full rounded-[10px] border border-[#e8e8ea] z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ViewportTracker onChange={onBoundsChange ?? (() => {})} />
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.latitude, m.longitude]}
          icon={priceIcon(m.price, (m.promotionBadges?.length ?? 0) > 0)}
          title={m.title}
        />
      ))}
    </MapContainer>
  );
}
