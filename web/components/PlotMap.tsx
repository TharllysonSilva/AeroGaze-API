'use client';
import { useState } from 'react';
import { useGoogleMapsKey } from './MapProvider';
import { GooglePlotMap } from './GooglePlotMap';
import type { Plot } from '@/lib/types';

export interface MapPoint {
  lat: number;
  lon: number;
  tone: 'primary' | 'secondary' | 'error' | 'warning';
  label?: string;
}

const FILL = { primary: 'fill-primary-container', secondary: 'fill-secondary-container', error: 'fill-error', warning: 'fill-warning' };

/**
 * Mapa vetorial dos talhões/piquetes (os mesmos polígonos do PostGIS) com os eventos recentes.
 * Sem provedor de mapa e sem chave de API: serve para a demonstração e funciona offline.
 * Troque por Google Maps/MapLibre quando precisar de imagem de satélite.
 */
function SchematicPlotMap({ plots, points }: { plots: Plot[]; points: MapPoint[] }) {
  const [zoom,setZoom]=useState(1),[selected,setSelected]=useState('');
  const rings = plots.map((p) => p.boundary.coordinates[0]);
  const coords = [...rings.flat(), ...points.map((p) => [p.lon, p.lat])];
  if (coords.length === 0) {
    return <div className="grid h-[320px] place-items-center rounded-md bg-surface-lowest text-body-sm text-on-surface-variant">Nenhum talhão cadastrado nesta fazenda.</div>;
  }

  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const W = 800, H = 460, pad = 44;
  const spanX = Math.max((maxLon - minLon) * kx, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const px = (lon: number) => offX + (lon - minLon) * kx * scale;
  const py = (lat: number) => offY + (maxLat - lat) * scale;

  return (<div className="schematic-map"><div className="schematic-map-controls mb-3 flex"><button type="button" aria-label="Aproximar mapa" onClick={()=>setZoom(Math.min(zoom+.25,3))}>＋ Aproximar</button><button type="button" aria-label="Afastar mapa" onClick={()=>setZoom(Math.max(zoom-.25,1))}>− Afastar</button><button type="button" onClick={()=>{setZoom(1);setSelected('')}}>Restaurar</button></div>
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-md bg-surface-lowest" role="img" aria-label="Mapa dos talhões e eventos recentes">
      <g transform={`translate(${W/2} ${H/2}) scale(${zoom}) translate(${-W/2} ${-H/2})`}>
      {plots.map((p, i) => {
        const ring = rings[i];
        const d = ring.map(([lon, lat], k) => `${k === 0 ? 'M' : 'L'}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`).join(' ') + ' Z';
        const cx = ring.reduce((s, c) => s + px(c[0]), 0) / ring.length;
        const cy = ring.reduce((s, c) => s + py(c[1]), 0) / ring.length;
        return (
          <g key={p.id} onClick={()=>setSelected(`${p.name} • ${p.kind}`)} className="cursor-pointer" tabIndex={0} role="button" aria-label={p.name} onKeyDown={e=>{if(e.key==='Enter')setSelected(`${p.name} • ${p.kind}`)}}>
            <path d={d} className="fill-primary/5 stroke-primary/60" strokeWidth="1.5" />
            <text x={cx} y={cy} textAnchor="middle" className="fill-on-surface-variant font-display" fontSize="13" letterSpacing="1">
              {p.name.toUpperCase()}
            </text>
          </g>
        );
      })}
      {points.map((pt, i) => (
        <g key={i} onClick={()=>setSelected(pt.label??'Evento')} className="cursor-pointer" tabIndex={0} role="button" aria-label={pt.label??'Evento'} onKeyDown={e=>{if(e.key==='Enter')setSelected(pt.label??'Evento')}}>
          <circle cx={px(pt.lon)} cy={py(pt.lat)} r="11" className={`${FILL[pt.tone]} opacity-20`} />
          <circle cx={px(pt.lon)} cy={py(pt.lat)} r="5" className={FILL[pt.tone]}>
            {pt.label && <title>{pt.label}</title>}
          </circle>
        </g>
      ))}
      </g>
    </svg>
    {selected&&<p role="status" className="mt-3 text-secondary">{selected}</p>}</div>
  );
}

export function PlotMap({plots,points}:{plots:Plot[];points:MapPoint[]}) {
  const apiKey=useGoogleMapsKey();
  const [unavailable,setUnavailable]=useState(false);
  if(apiKey&&!unavailable)return <GooglePlotMap apiKey={apiKey} plots={plots} points={points} onUnavailable={()=>setUnavailable(true)}/>;
  return <div><p className="geographic-map-notice">{unavailable?'Google Maps indisponível. Exibindo somente o esquema dos talhões.':'Mapa geográfico aguardando a chave Google. Abaixo está apenas o esquema dos talhões.'}</p>{unavailable&&<button onClick={()=>setUnavailable(false)}>Tentar carregar Google Maps</button>}<SchematicPlotMap plots={plots} points={points}/></div>;
}
