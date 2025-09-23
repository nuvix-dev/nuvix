import { configuration } from '@nuvix/utils';

export interface AuthMethod {
  name: string;
  key: string;
  enabled: boolean;
}

export const defaultAuthConfig = {
  limit: 0,
  sessionsLimit: configuration.limits.userSessionsDefault,
  passwordHistory: 0,
  passwordDictionary: false,
  duration: 31536000,
  personalDataCheck: false,
  mockNumbers: [],
  sessionAlerts: false,
  membershipsUserName: false,
  membershipsUserEmail: false,
  membershipsMfa: false,
};

const authMethods: Record<string, AuthMethod> = {
  'email-password': {
    name: 'Email/Password',
    key: 'emailPassword',
    enabled: true,
  },
  'magic-url': {
    name: 'Magic URL',
    key: 'usersAuthMagicURL',

    enabled: true,
  },
  'email-otp': {
    name: 'Email (OTP)',
    key: 'emailOtp',
    enabled: true,
  },
  anonymous: {
    name: 'Anonymous',
    key: 'anonymous',
    enabled: true,
  },
  invites: {
    name: 'Invites',
    key: 'invites',
    enabled: true,
  },
  jwt: {
    name: 'JWT',
    key: 'JWT',
    enabled: true,
  },
  phone: {
    name: 'Phone',
    key: 'phone',
    enabled: true,
  },
};

export default authMethods;
