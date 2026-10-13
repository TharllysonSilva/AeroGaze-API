'use client';
import { createContext, useContext } from 'react';

const MapConfig = createContext('');
export function MapProvider({apiKey,children}:{apiKey:string;children:React.ReactNode}) {
  return <MapConfig.Provider value={apiKey}>{children}</MapConfig.Provider>;
}
export const useGoogleMapsKey = () => useContext(MapConfig);
