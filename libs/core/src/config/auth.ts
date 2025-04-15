import { APP_LIMIT_USER_SESSIONS_DEFAULT } from '@nuvix/utils/constants';

export interface AuthMethod {
  name: string;
  key: string;
  icon: string;
  docs: string;
  enabled: boolean;
}

export const defaultAuthConfig = {
  limit: 0,
  sessionsLimit: APP_LIMIT_USER_SESSIONS_DEFAULT,
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
    icon: '/images/users/email.png',
    docs: 'https://nuvix.io/docs/references/cloud/client-web/account#accountCreateEmailPasswordSession',
    enabled: true,
  },
  'magic-url': {
    name: 'Magic URL',
    key: 'usersAuthMagicURL',
    icon: '/images/users/magic-url.png',
    docs: 'https://nuvix.io/docs/references/cloud/client-web/account#accountCreateMagicURLToken',
    enabled: true,
  },
  'email-otp': {
    name: 'Email (OTP)',
    key: 'emailOtp',
    icon: '/images/users/email.png',
    docs: 'https://nuvix.io/docs/references/cloud/client-web/account#accountCreateEmailToken',
    enabled: true,
  },
  anonymous: {
    name: 'Anonymous',
    key: 'anonymous',
    icon: '/images/users/anonymous.png',
    docs: 'https://nuvix.io/docs/references/cloud/client-web/account#accountCreateAnonymousSession',
    enabled: true,
  },
  invites: {
    name: 'Invites',
    key: 'invites',
    icon: '/images/users/invites.png',
    docs: 'https://nuvix.io/docs/client/teams?sdk=web-default#teamsCreateMembership',
    enabled: true,
  },
  jwt: {
    name: 'JWT',
    key: 'JWT',
    icon: '/images/users/jwt.png',
    docs: 'https://nuvix.io/docs/client/account?sdk=web-default#accountCreateJWT',
    enabled: true,
  },
  phone: {
    name: 'Phone',
    key: 'phone',
    icon: '/images/users/phone.png',
    docs: 'https://nuvix.io/docs/references/cloud/client-web/account#accountCreatePhoneToken',
    enabled: true,
  },
};

export default authMethods;
