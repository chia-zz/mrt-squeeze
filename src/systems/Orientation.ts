import { CONFIG } from '../data';

const L = CONFIG.layout;

/**
 * 車廂可以放在畫面上方（預設）或下方。
 * 所有版面數值都以「車廂在上」寫在 config.json（設計座標），
 * 車廂在下時，把「車廂外牆頂 ～ 月台底」這段上下鏡像。HUD 與底部按鈕不動。
 */
const AXIS = L.carriage.top - L.carriage.wall / 2 + L.platform.bottom;

let flipped = false;

export function setFlipped(value: boolean) {
  flipped = value;
}

export function isFlipped(): boolean {
  return flipped;
}

/** 設計座標 y ⇄ 畫面座標 y（互為反函數，兩個方向都用它） */
export function Y(y: number): number {
  return flipped ? AXIS - y : y;
}

/** 設計座標裡 top + 高度的矩形，回傳它在畫面上的 top */
export function rectTop(top: number, h: number): number {
  return flipped ? AXIS - top - h : top;
}

/** 畫面上「往車廂裡面」的 y 方向：車廂在上 = -1（往上），車廂在下 = 1（往下） */
export function inward(): number {
  return flipped ? 1 : -1;
}
