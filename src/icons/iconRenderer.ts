import { ICON_SVGS, type IconKey } from './svgs';
import iconMap from './iconNames.json';

const ICON_CLASS = 'shiki-vscode-icon';

export function createIconElement(iconId: string): HTMLElement {
  const svg = ICON_SVGS[iconId as IconKey];
  const wrapper = document.createElement('span');
  wrapper.className = ICON_CLASS;
  wrapper.setAttribute('aria-hidden', 'true');
  // Insert raw SVG string. SVGs are bundled as strings via ?raw imports.
  wrapper.innerHTML = svg ?? '';
  return wrapper;
}

export function findTitleElement(frameEl: HTMLElement): HTMLElement | null {
  // Try common expressive-code frame title selectors
  const selectors = [
    '.ec-frame-title',
    '.ec-frame__title',
    '.ec-frame-header',
    '.ec-frame .header',
    '.ec-frame > .title',
    'header',
    '.frame-title',
  ];

  for (const sel of selectors) {
    const el = frameEl.querySelector(sel) as HTMLElement | null;
    if (el) return el;
  }

  // Fallback: try first child heading inside frame
  const heading = frameEl.querySelector('h1,h2,h3,h4,h5') as HTMLElement | null;
  return heading;
}

export function getIconIdFor(filenameOrLang?: string): string | undefined {
  if (!filenameOrLang) return undefined;
  const key = filenameOrLang.toLowerCase();
  // If it's a filename with extension, extract ext
  const parts = key.split('/').pop()?.split('.') ?? [];
  const ext = parts.length > 1 ? parts.pop() : undefined;

  const map = iconMap as Record<string, string>;
  if (ext && map[ext]) return map[ext];
  if (map[key]) return map[key];

  return undefined;
}

export function injectIconIntoFrame(frameEl: HTMLElement, options?: { filename?: string; language?: string }): boolean {
  const titleEl = findTitleElement(frameEl) ?? frameEl;
  const iconId = getIconIdFor(options?.filename) ?? getIconIdFor(options?.language);
  if (!iconId) return false;
  const iconEl = createIconElement(iconId);
  // Prepend icon to title
  titleEl.prepend(iconEl);
  return true;
}

export default { createIconElement, injectIconIntoFrame, getIconIdFor };
