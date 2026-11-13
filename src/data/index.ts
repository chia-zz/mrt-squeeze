import passengersJson from './passengers.json';
import routeJson from './route.json';
import configJson from './config.json';
import stringsJson from './strings.json';

export type PassengerAction = 'inward' | 'transform' | 'none';

export interface PassengerType {
  name: string;
  label: string;
  color: string;
  w: number;
  h: number;
  density: number;
  frictionAir: number;
  pushFactor: number;
  pressureLimit: number;
  action: PassengerAction;
  transformTo?: string;
  special?: 'prioritySeat';
  backpack?: boolean;
}

export interface PassengerData {
  types: Record<string, PassengerType>;
  spawnWeights: Record<string, number>;
  specialWeights: Record<string, number>;
  initialWeights: Record<string, number>;
}

export interface Station {
  name: string;
  joke: string;
  platform: number;
  doorSeconds: number;
  alightRatio: number;
  specialChance: number;
  note?: string;
}

export interface RouteData {
  lineName: string;
  lineColor: string;
  initialInCarriage: number;
  stations: Station[];
}

export const PASSENGERS = passengersJson as unknown as PassengerData;
export const ROUTE = routeJson as RouteData;
export const CONFIG = configJson;
export const STRINGS = stringsJson;

export type Config = typeof configJson;
export type PushMode = 'drag' | 'sling';

/** 套用 {key} 參數到 strings.json 的字串 */
export function t(key: keyof typeof stringsJson, params: Record<string, string | number> = {}): string {
  return STRINGS[key].replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
}

export function hex(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}

export function pickWeighted(weights: Record<string, number>, rand: () => number = Math.random): string {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}
