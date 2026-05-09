import { en, type StringTree } from './en';

const dictionaries: Record<string, StringTree> = { en };
let currentLanguage = 'en';

export function setLanguage(lang: string): void {
  if (!(lang in dictionaries)) {
    throw new Error(`Language not loaded: ${lang}`);
  }
  currentLanguage = lang;
}

function lookup(key: string, dict: StringTree): string | undefined {
  const segments = key.split('.');
  let cursor: unknown = dict;
  for (const seg of segments) {
    if (cursor && typeof cursor === 'object' && seg in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = dictionaries[currentLanguage] ?? dictionaries.en;
  const fallback = dictionaries.en;
  const raw = (dict && lookup(key, dict)) ?? (fallback && lookup(key, fallback)) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = vars[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}
