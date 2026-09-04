import { describe, it, expect } from 'vitest';
import { translations } from '../src/i18n';
import type { SupportedLang } from '../src/i18n';

describe('Integration Test: Multi-Country ADEO i18n Completeness', () => {
  const expectedLanguages: SupportedLang[] = ['fr', 'en', 'es', 'pt', 'pt-BR', 'it', 'pl', 'uk', 'ro'];

  it('contains all 9 ADEO business unit languages', () => {
    expectedLanguages.forEach(lang => {
      expect(translations[lang]).toBeDefined();
    });
  });

  it('preserves the exact brand name "Meeting Heroes" across all languages', () => {
    expectedLanguages.forEach(lang => {
      expect(translations[lang].brandName).toBe('Meeting Heroes');
    });
  });

  it('guarantees complete translation keys without undefined or empty values in any language', () => {
    const referenceKeys = Object.keys(translations.fr) as (keyof typeof translations.fr)[];

    expectedLanguages.forEach(lang => {
      const dict = translations[lang];
      referenceKeys.forEach(key => {
        const val = dict[key];
        expect(val, `Missing key "${key}" in language "${lang}"`).toBeDefined();

        if (typeof val === 'string') {
          expect(val.trim().length, `Empty string for key "${key}" in language "${lang}"`).toBeGreaterThan(0);
        } else if (typeof val === 'function') {
          // Verify function returns non-empty string
          const res = (val as any)(3);
          expect(typeof res).toBe('string');
          expect(res.length).toBeGreaterThan(0);
        } else if (typeof val === 'object' && val !== null) {
          // Check nested criteria objects
          Object.entries(val).forEach(([subKey, subVal]) => {
            expect(typeof subVal, `Missing subKey "${subKey}" in "${key}" for "${lang}"`).toBe('string');
            expect((subVal as string).length).toBeGreaterThan(0);
          });
        }
      });
    });
  });
});
