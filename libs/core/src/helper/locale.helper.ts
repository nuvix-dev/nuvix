import { PROJECT_ROOT } from '@nuvix/utils/constants';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Class to handle translations for different locales.
 */
export class LocaleTranslator {
  private locale: string;
  private translations: { [key: string]: string };

  default = 'en';

  constructor(locale: string = 'en') {
    this.locale = locale;
    this.translations = this.loadTranslations(locale);
  }

  private loadTranslations(locale: string): { [key: string]: string } {
    const filePath = path.resolve(
      PROJECT_ROOT,
      `assets/locale/translations/${locale}.json`,
    );
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent);
    } else {
      throw new Error(`Translation file for locale ${locale} not found.`);
    }
  }

  public setLocale(locale: string): void {
    this.locale = locale;
    this.translations = this.loadTranslations(locale);
  }

  public getText<T = any>(key: string, defaultValue: string | any = null): T {
    return this.translations[key] ?? defaultValue;
  }
}
