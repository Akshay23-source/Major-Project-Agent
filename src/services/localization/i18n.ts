import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPPORTED_LANGUAGES } from './languages';

// Import all translations
import en from './translations/en.json';
import hi from './translations/hi.json';
import kn from './translations/kn.json';
import as from './translations/as.json';
import bn from './translations/bn.json';
import brx from './translations/brx.json';
import doi from './translations/doi.json';
import gu from './translations/gu.json';
import ks from './translations/ks.json';
import kok from './translations/kok.json';
import mai from './translations/mai.json';
import ml from './translations/ml.json';
import mni from './translations/mni.json';
import mr from './translations/mr.json';
import ne from './translations/ne.json';
import _or from './translations/or.json'; // or is reserved keyword in some contexts, safe to alias
import pa from './translations/pa.json';
import sa from './translations/sa.json';
import sat from './translations/sat.json';
import sd from './translations/sd.json';
import ta from './translations/ta.json';
import te from './translations/te.json';
import ur from './translations/ur.json';

const translations = {
  en, as, bn, brx, doi, gu, hi, kn, ks, kok, mai, ml, mni, mr, ne, or: _or, pa, sa, sat, sd, ta, te, ur
};

export const i18n = new I18n(translations);

// Set default fallback
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

const LANGUAGE_KEY = '@agriagent_language';

export const getDeviceLanguage = () => {
  const locales = getLocales();
  if (locales && locales.length > 0) {
    const langCode = locales[0].languageCode;
    if (langCode && SUPPORTED_LANGUAGES.some(l => l.code === langCode)) {
      return langCode;
    }
  }
  return 'en';
};

export const initializeI18n = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage && SUPPORTED_LANGUAGES.some(l => l.code === savedLanguage)) {
      i18n.locale = savedLanguage;
    } else {
      i18n.locale = getDeviceLanguage();
    }
  } catch (error) {
    console.error('Failed to load language preference', error);
    i18n.locale = getDeviceLanguage();
  }
};

export const setLanguage = async (code: string) => {
  if (SUPPORTED_LANGUAGES.some(l => l.code === code)) {
    i18n.locale = code;
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, code);
    } catch (error) {
      console.error('Failed to save language preference', error);
    }
  }
};

export const t = (key: string, options?: any) => {
  return i18n.t(key, options);
};
