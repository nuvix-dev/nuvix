import { Origin } from '../../src/validators/network/origin'
import { Platform } from '../../src/validators/network/platform'
import { Doc, ID } from '@nuvix/db'
import { describe, it, expect } from 'vitest'

describe('Origin', () => {
  it('should validate origins correctly', () => {
    const validator = new Origin([
      new Doc({
        $collection: ID.custom('platforms'),
        name: 'Production',
        type: Platform.TYPE_WEB,
        hostname: 'nuvix.io',
      }),
      new Doc({
        $collection: ID.custom('platforms'),
        name: 'Development',
        type: Platform.TYPE_WEB,
        hostname: 'nuvix.test',
      }),
      new Doc({
        $collection: ID.custom('platforms'),
        name: 'Localhost',
        type: Platform.TYPE_WEB,
        hostname: 'localhost',
      }),
      new Doc({
        $collection: ID.custom('platforms'),
        name: 'Flutter',
        type: Platform.TYPE_FLUTTER_WEB,
        hostname: 'nuvix.flutter',
      }),
      new Doc({
        $collection: ID.custom('platforms'),
        name: 'Expo',
        type: Platform.TYPE_SCHEME,
        key: 'exp',
      }),
      new Doc({
        $collection: ID.custom('platforms'),
        name: 'Nuvix Callback',
        type: Platform.TYPE_SCHEME,
        key: 'nuvix-callback-123',
      }),
    ])

    expect(validator.$valid('')).toBe(false)
    expect(validator.$valid('/')).toBe(false)

    expect(validator.$valid('https://localhost')).toBe(true)
    expect(validator.$valid('http://localhost')).toBe(true)
    expect(validator.$valid('http://localhost:80')).toBe(true)

    expect(validator.$valid('https://nuvix.io')).toBe(true)
    expect(validator.$valid('http://nuvix.io')).toBe(true)
    expect(validator.$valid('http://nuvix.io:80')).toBe(true)

    expect(validator.$valid('https://nuvix.test')).toBe(true)
    expect(validator.$valid('http://nuvix.test')).toBe(true)
    expect(validator.$valid('http://nuvix.test:80')).toBe(true)

    expect(validator.$valid('https://nuvix.flutter')).toBe(true)
    expect(validator.$valid('http://nuvix.flutter')).toBe(true)
    expect(validator.$valid('http://nuvix.flutter:80')).toBe(true)

    expect(validator.$valid('https://example.com')).toBe(false)
    expect(validator.$valid('http://example.com')).toBe(false)
    expect(validator.$valid('http://example.com:80')).toBe(false)

    expect(validator.$valid('exp://')).toBe(true)
    expect(validator.$valid('exp:///')).toBe(true)
    expect(validator.$valid('exp://index')).toBe(true)

    expect(validator.$valid('nuvix-callback-123://')).toBe(true)
    expect(validator.$valid('nuvix-callback-456://')).toBe(false)

    expect(validator.$valid('nuvix-ios://com.company.appname')).toBe(false)
    expect(validator.$description).toBe(
      'Invalid Origin. Register your new client (com.company.appname) as a new iOS platform on your project console dashboard',
    )

    expect(validator.$valid('nuvix-android://com.company.appname')).toBe(false)
    expect(validator.$description).toBe(
      'Invalid Origin. Register your new client (com.company.appname) as a new Android platform on your project console dashboard',
    )

    expect(validator.$valid('nuvix-macos://com.company.appname')).toBe(false)
    expect(validator.$description).toBe(
      'Invalid Origin. Register your new client (com.company.appname) as a new macOS platform on your project console dashboard',
    )

    expect(validator.$valid('nuvix-linux://com.company.appname')).toBe(false)
    expect(validator.$description).toBe(
      'Invalid Origin. Register your new client (com.company.appname) as a new Linux platform on your project console dashboard',
    )

    expect(validator.$valid('nuvix-windows://com.company.appname')).toBe(false)
    expect(validator.$description).toBe(
      'Invalid Origin. Register your new client (com.company.appname) as a new Windows platform on your project console dashboard',
    )

    expect(validator.$valid('chrome-extension://com.company.appname')).toBe(
      false,
    )
    expect(validator.$description).toBe(
      'Invalid Origin. Register your new client (com.company.appname) as a new Web (Chrome Extension) platform on your project console dashboard',
    )

    expect(validator.$valid('moz-extension://com.company.appname')).toBe(false)
    expect(validator.$description).toBe(
      'Invalid Origin. Register your new client (com.company.appname) as a new Web (Firefox Extension) platform on your project console dashboard',
    )

    expect(validator.$valid('safari-web-extension://com.company.appname')).toBe(
      false,
    )
    expect(validator.$description).toBe(
      'Invalid Origin. Register your new client (com.company.appname) as a new Web (Safari Extension) platform on your project console dashboard',
    )

    expect(validator.$valid('ms-browser-extension://com.company.appname')).toBe(
      false,
    )
    expect(validator.$description).toBe(
      'Invalid Origin. Register your new client (com.company.appname) as a new Web (Edge Extension) platform on your project console dashboard',
    )

    expect(validator.$valid('random-scheme://localhost')).toBe(false)
    expect(validator.$description).toBe(
      'Invalid Scheme. The scheme used (random-scheme) in the Origin (random-scheme://localhost) is not supported. If you are using a custom scheme, please change it to `nuvix-callback-<PROJECT_ID>`',
    )
  })
})
