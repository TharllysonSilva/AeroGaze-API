'use client';
import { useEffect, useRef, useState } from 'react';
import type { Plot } from '@/lib/types';
import { parsePosition, plotPaths, validPosition } from '@/lib/map-coordinates';
import type { MapPoint } from './PlotMap';

let mapsLoader:Promise<any>|null=null;
function loadGoogleMaps(apiKey:string):Promise<any> {
  const win=window as Window&{google?:any;gm_authFailure?:()=>void;__aerogazeGoogleMapsReady?:()=>void};
  if(win.google?.maps?.importLibrary)return Promise.resolve(win.google.maps);
  if(mapsLoader)return mapsLoader;
  mapsLoader=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const timer=setTimeout(()=>{script.remove();mapsLoader=null;reject(new Error('Mapa indisponível'))},20000);
    script.async=true;
    win.gm_authFailure=()=>window.dispatchEvent(new Event('aerogaze-google-auth-error'));
    win.__aerogazeGoogleMapsReady=()=>{clearTimeout(timer);if(win.google?.maps)resolve(win.google.maps);else{mapsLoader=null;reject(new Error('Mapa indisponível'))}};
    script.onerror=()=>{clearTimeout(timer);script.remove();mapsLoader=null;reject(new Error('Mapa indisponível'))};
    script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=__aerogazeGoogleMapsReady&language=pt-BR&region=BR`;
    document.head.appendChild(script);
  });
  return mapsLoader;
}

export function GooglePlotMap({apiKey,plots,points,onUnavailable}:{apiKey:string;plots:Plot[];points:MapPoint[];onUnavailable:()=>void}) {
  const host=useRef<HTMLDivElement>(null),map=useRef<any>(null),maps=useRef<any>(null),overlays=useRef<any[]>([]),info=useRef<any>(null),centered=useRef(false);
  const [ready,setReady]=useState(false),[kind,setKind]=useState('satellite'),[latitude,setLatitude]=useState(''),[longitude,setLongitude]=useState(''),[notice,setNotice]=useState('');
  const paths=plotPaths(plots),locations=points.filter(p=>validPosition(p.lat,p.lon));
  function fitFarm(){if(!map.current||!maps.current)return;const bounds=new maps.current.LatLngBounds();paths.forEach(p=>p.paths.flat().forEach(c=>bounds.extend(c)));locations.forEach(p=>bounds.extend({lat:p.lat,lng:p.lon}));if(!bounds.isEmpty())map.current.fitBounds(bounds,32)}
  useEffect(()=>{
    let active=true;const authError=()=>{if(active)onUnavailable()};window.addEventListener('aerogaze-google-auth-error',authError);
    loadGoogleMaps(apiKey).then(async g=>{await g.importLibrary('maps');if(!active||!host.current)return;maps.current=g;map.current=new g.Map(host.current,{center:{lat:-15.78,lng:-47.93},zoom:5,mapTypeId:'satellite',gestureHandling:'cooperative',streetViewControl:false,fullscreenControl:true,mapTypeControl:false});info.current=new g.InfoWindow();setReady(true)}).catch(()=>{if(active)onUnavailable()});
    return()=>{active=false;window.removeEventListener('aerogaze-google-auth-error',authError);overlays.current.forEach(o=>o.setMap(null));info.current?.close();if(map.current&&maps.current)maps.current.event.clearInstanceListeners(map.current);map.current=null};
  },[apiKey]);
  useEffect(()=>{
    if(!ready||!map.current)return;
    overlays.current.forEach(o=>o.setMap(null));overlays.current=[];
    const g=maps.current;
    function show(text:string,position:any){const content=document.createElement('div');content.className='google-map-info';content.textContent=text;info.current.setContent(content);info.current.setPosition(position);info.current.open({map:map.current});setNotice(text)}
    paths.forEach(p=>{const polygon=new g.Polygon({paths:p.paths,map:map.current,strokeColor:'#89e978',strokeWeight:2,fillColor:'#77c968',fillOpacity:.13});polygon.addListener('click',(event:any)=>show(`${p.name} • ${p.kind} • limite do cenário`,event.latLng??p.paths[0][0]));overlays.current.push(polygon)});
    const colors={primary:'#9bf59a',secondary:'#00daf3',error:'#ff8478',warning:'#ffd16b'};
    locations.forEach(p=>{const circle=new g.Circle({map:map.current,center:{lat:p.lat,lng:p.lon},radius:8,strokeWeight:2,strokeColor:'#142117',fillColor:colors[p.tone],fillOpacity:1,zIndex:5});circle.addListener('click',()=>show(p.label??'Ativo do cenário',{lat:p.lat,lng:p.lon}));overlays.current.push(circle)});
    if(!centered.current&&(paths.length||locations.length)){fitFarm();centered.current=true}
  },[ready,plots,points]);
  return <div className="geographic-map">
    <div className="geographic-map-controls"><button type="button" disabled={!ready} aria-pressed={kind==='roadmap'} onClick={()=>{setKind('roadmap');map.current?.setMapTypeId('roadmap')}}>Ruas</button><button type="button" disabled={!ready} aria-pressed={kind==='satellite'} onClick={()=>{setKind('satellite');map.current?.setMapTypeId('satellite')}}>Satélite</button><button type="button" aria-label="Aproximar mapa" disabled={!ready} onClick={()=>map.current?.setZoom((map.current.getZoom()??16)+1)}>＋ Aproximar</button><button type="button" aria-label="Afastar mapa" disabled={!ready} onClick={()=>map.current?.setZoom((map.current.getZoom()??16)-1)}>− Afastar</button><button type="button" disabled={!ready} onClick={fitFarm}>Centralizar fazenda</button></div>
    <div ref={host} className="google-geographic-canvas" role="region" aria-label="Mapa geográfico Google dos talhões e ativos"/>
    {!ready&&<p role="status">Carregando mapa Google…</p>}
    <div className="geographic-map-tools"><label>Localizar ativo<select aria-label="Localizar ativo no mapa" defaultValue="" disabled={!ready} onChange={e=>{const p=locations[Number(e.target.value)];if(!p||!map.current)return;map.current.panTo({lat:p.lat,lng:p.lon});map.current.setZoom(19);setNotice(p.label??'Ativo selecionado')}}><option value="" disabled>Selecione um ativo</option>{locations.map((p,i)=><option key={`${p.label}-${i}`} value={i}>{p.label??`Ativo ${i+1}`}</option>)}</select></label>
    <form onSubmit={e=>{e.preventDefault();const position=parsePosition(latitude,longitude);if(!position){setNotice('Informe latitude entre -90 e 90 e longitude entre -180 e 180.');return}map.current?.panTo(position);map.current?.setZoom(18);setNotice(`Local: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`)}}><input aria-label="Latitude do local" placeholder="Latitude" value={latitude} onChange={e=>setLatitude(e.target.value)}/><input aria-label="Longitude do local" placeholder="Longitude" value={longitude} onChange={e=>setLongitude(e.target.value)}/><button disabled={!ready}>Ir para local</button></form></div>
    {notice&&<p role="status" className="geographic-map-notice">{notice}</p>}
    <small>Mapa base: Google • limites e ativos do cenário são fictícios • a vista de satélite não é telemetria ao vivo.</small>
  </div>;
}
