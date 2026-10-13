import type { Plot } from './types';

export function validPosition(lat:unknown,lon:unknown):boolean {
  return typeof lat==='number'&&typeof lon==='number'&&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
}
export function plotPaths(plots:Plot[]) {
  return plots.flatMap(plot=>{
    if(plot.boundary?.type!=='Polygon')return [];
    const paths=plot.boundary.coordinates.map(ring=>ring.filter(c=>validPosition(c[1],c[0])).map(([lng,lat])=>({lat,lng})));
    return paths[0]?.length>=3?[{id:plot.id,name:plot.name,kind:plot.kind,paths}]:[];
  });
}
export function parsePosition(lat:string,lon:string) {
  if(!lat.trim()||!lon.trim())return null;
  const latitude=Number(lat.replace(',','.')),longitude=Number(lon.replace(',','.'));
  return validPosition(latitude,longitude)?{lat:latitude,lng:longitude}:null;
}
