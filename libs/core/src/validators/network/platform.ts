import type { PlatformsDoc } from '@nuvix/utils/types';

export class Platform {
  public static readonly TYPE_UNKNOWN = 'unknown';
  public static readonly TYPE_WEB = 'web';
  public static readonly TYPE_FLUTTER_IOS = 'flutter-ios';
  public static readonly TYPE_FLUTTER_ANDROID = 'flutter-android';
  public static readonly TYPE_FLUTTER_MACOS = 'flutter-macos';
  public static readonly TYPE_FLUTTER_WINDOWS = 'flutter-windows';
  public static readonly TYPE_FLUTTER_LINUX = 'flutter-linux';
  public static readonly TYPE_FLUTTER_WEB = 'flutter-web';
  public static readonly TYPE_APPLE_IOS = 'apple-ios';
  public static readonly TYPE_APPLE_MACOS = 'apple-macos';
  public static readonly TYPE_APPLE_WATCHOS = 'apple-watchos';
  public static readonly TYPE_APPLE_TVOS = 'apple-tvos';
  public static readonly TYPE_ANDROID = 'android';
  public static readonly TYPE_UNITY = 'unity';
  public static readonly TYPE_REACT_NATIVE_IOS = 'react-native-ios';
  public static readonly TYPE_REACT_NATIVE_ANDROID = 'react-native-android';
  public static readonly TYPE_SCHEME = 'scheme';

  public static readonly SCHEME_HTTP = 'http';
  public static readonly SCHEME_HTTPS = 'https';
  public static readonly SCHEME_CHROME_EXTENSION = 'chrome-extension';
  public static readonly SCHEME_FIREFOX_EXTENSION = 'moz-extension';
  public static readonly SCHEME_SAFARI_EXTENSION = 'safari-web-extension';
  public static readonly SCHEME_EDGE_EXTENSION = 'ms-browser-extension';
  public static readonly SCHEME_IOS = 'appwrite-ios';
  public static readonly SCHEME_MACOS = 'appwrite-macos';
  public static readonly SCHEME_WATCHOS = 'appwrite-watchos';
  public static readonly SCHEME_TVOS = 'appwrite-tvos';
  public static readonly SCHEME_ANDROID = 'appwrite-android';
  public static readonly SCHEME_WINDOWS = 'appwrite-windows';
  public static readonly SCHEME_LINUX = 'appwrite-linux';

  private static readonly names: Record<string, string> = {
    [Platform.SCHEME_HTTP]: 'Web',
    [Platform.SCHEME_HTTPS]: 'Web',
    [Platform.SCHEME_IOS]: 'iOS',
    [Platform.SCHEME_MACOS]: 'macOS',
    [Platform.SCHEME_WATCHOS]: 'watchOS',
    [Platform.SCHEME_TVOS]: 'tvOS',
    [Platform.SCHEME_ANDROID]: 'Android',
    [Platform.SCHEME_WINDOWS]: 'Windows',
    [Platform.SCHEME_LINUX]: 'Linux',
    [Platform.SCHEME_CHROME_EXTENSION]: 'Web (Chrome Extension)',
    [Platform.SCHEME_FIREFOX_EXTENSION]: 'Web (Firefox Extension)',
    [Platform.SCHEME_SAFARI_EXTENSION]: 'Web (Safari Extension)',
    [Platform.SCHEME_EDGE_EXTENSION]: 'Web (Edge Extension)',
  };

  public static getNameByScheme(scheme?: string): string {
    return scheme ? Platform.names[scheme] || '' : '';
  }

  public static getHostnames(platforms: Array<PlatformsDoc>): string[] {
    const hostnames: string[] = [];

    for (const platform of platforms) {
      const type = (
        platform.get('type') || Platform.TYPE_UNKNOWN
      ).toLowerCase();
      const hostname = (platform.get('hostname') || '').toLowerCase();
      const key = (platform.get('key') || '').toLowerCase();

      switch (type) {
        case Platform.TYPE_WEB:
        case Platform.TYPE_FLUTTER_WEB:
          if (hostname) {
            hostnames.push(hostname);
          }
          break;
        case Platform.TYPE_FLUTTER_IOS:
        case Platform.TYPE_FLUTTER_ANDROID:
        case Platform.TYPE_FLUTTER_MACOS:
        case Platform.TYPE_FLUTTER_WINDOWS:
        case Platform.TYPE_FLUTTER_LINUX:
        case Platform.TYPE_ANDROID:
        case Platform.TYPE_APPLE_IOS:
        case Platform.TYPE_APPLE_MACOS:
        case Platform.TYPE_APPLE_WATCHOS:
        case Platform.TYPE_APPLE_TVOS:
        case Platform.TYPE_REACT_NATIVE_IOS:
        case Platform.TYPE_REACT_NATIVE_ANDROID:
        case Platform.TYPE_UNITY:
          if (key) {
            hostnames.push(key);
          }
          break;
      }
    }

    return [...new Set(hostnames)];
  }

  public static getSchemes(platforms: Array<PlatformsDoc>): string[] {
    const schemes: string[] = [];

    for (const platform of platforms) {
      const type = (
        platform.get('type') || Platform.TYPE_UNKNOWN
      ).toLowerCase();
      const scheme = (platform.get('key') || '').toLowerCase();

      switch (type) {
        case Platform.TYPE_SCHEME:
          if (scheme && /^[a-z][a-z0-9+.-]*$/.test(scheme)) {
            schemes.push(scheme);
          }
          break;
        case Platform.TYPE_WEB:
        case Platform.TYPE_FLUTTER_WEB:
          schemes.push(Platform.SCHEME_HTTP, Platform.SCHEME_HTTPS);
          break;
        case Platform.TYPE_FLUTTER_IOS:
        case Platform.TYPE_APPLE_IOS:
        case Platform.TYPE_REACT_NATIVE_IOS:
          schemes.push(Platform.SCHEME_IOS);
          break;
        case Platform.TYPE_FLUTTER_ANDROID:
        case Platform.TYPE_ANDROID:
        case Platform.TYPE_REACT_NATIVE_ANDROID:
          schemes.push(Platform.SCHEME_ANDROID);
          break;
        case Platform.TYPE_FLUTTER_MACOS:
        case Platform.TYPE_APPLE_MACOS:
          schemes.push(Platform.SCHEME_MACOS);
          break;
        case Platform.TYPE_FLUTTER_WINDOWS:
        case Platform.TYPE_UNITY:
          schemes.push(Platform.SCHEME_WINDOWS);
          break;
        case Platform.TYPE_FLUTTER_LINUX:
          schemes.push(Platform.SCHEME_LINUX);
          break;
        case Platform.TYPE_APPLE_WATCHOS:
          schemes.push(Platform.SCHEME_WATCHOS);
          break;
        case Platform.TYPE_APPLE_TVOS:
          schemes.push(Platform.SCHEME_TVOS);
          break;
      }
    }

    return [...new Set(schemes)];
  }
}
