import { CONFIG, type PushMode } from '../data';

/** 存在 localStorage 的玩家偏好；讀寫失敗（無痕模式等）就用預設值 */
const KEYS = {
  mode: 'mrt-squeeze.pushMode',
  tutorial: 'mrt-squeeze.tutorialSeen',
  carriage: 'mrt-squeeze.carriagePos',
};

export type CarriagePos = 'top' | 'bottom';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export const Settings = {
  get pushMode(): PushMode {
    const v = read(KEYS.mode);
    return v === 'drag' || v === 'sling' ? v : (CONFIG.push.defaultMode as PushMode);
  },
  set pushMode(v: PushMode) {
    write(KEYS.mode, v);
  },
  get tutorialSeen(): boolean {
    return read(KEYS.tutorial) === '1';
  },
  set tutorialSeen(v: boolean) {
    write(KEYS.tutorial, v ? '1' : '0');
  },
  get carriagePos(): CarriagePos {
    return read(KEYS.carriage) === 'bottom' ? 'bottom' : 'top';
  },
  set carriagePos(v: CarriagePos) {
    write(KEYS.carriage, v);
  },
};
