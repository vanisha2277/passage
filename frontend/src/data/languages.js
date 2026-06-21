/** @typedef {{ code: string, name: string, native: string, flag: string }} LanguageOption */

/** Structured target languages for translate + voice (Claude receives `name`). */
export const LANGUAGES = [
  { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
  { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇧🇷' },
  { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'tl', name: 'Tagalog', native: 'Filipino', flag: '🇵🇭' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська', flag: '🇺🇦' },
  { code: 'ht', name: 'Haitian Creole', native: 'Kreyòl', flag: '🇭🇹' },
  { code: 'am', name: 'Amharic', native: 'አማርኛ', flag: '🇪🇹' },
];

/** @param {string} code */
export function languageNameFromCode(code) {
  return LANGUAGES.find((l) => l.code === code)?.name ?? 'Spanish';
}

/** @param {string} name */
export function languageCodeFromName(name) {
  return LANGUAGES.find((l) => l.name === name)?.code ?? 'es';
}
