import { useState, useEffect, useCallback } from 'react';
import { i18n, setLanguage as setI18nLanguage, initializeI18n, getDeviceLanguage } from '../services/localization/i18n';
import { getLanguageByCode, SUPPORTED_LANGUAGES, LanguageConfig } from '../services/localization/languages';

let initialized = false;

export const useLocalization = () => {
  const [locale, setLocale] = useState(i18n.locale);
  const [isInitializing, setIsInitializing] = useState(!initialized);

  useEffect(() => {
    const init = async () => {
      if (!initialized) {
        await initializeI18n();
        initialized = true;
        setLocale(i18n.locale);
      }
      setIsInitializing(false);
    };
    init();
  }, []);

  const changeLanguage = useCallback(async (code: string) => {
    await setI18nLanguage(code);
    setLocale(code);
    // Optional: trigger re-renders or broadcast event if context isn't fully reactive
  }, []);

  const t = useCallback((key: string, options?: any) => {
    return i18n.t(key, { locale, ...options });
  }, [locale]);

  return {
    locale,
    changeLanguage,
    t,
    currentLanguage: getLanguageByCode(locale) || getLanguageByCode('en') as LanguageConfig,
    supportedLanguages: SUPPORTED_LANGUAGES,
    isInitializing
  };
};
