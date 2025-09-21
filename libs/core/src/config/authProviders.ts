interface OAuthProvider {
  name: string;
  developers: string;
  sandbox: boolean;
  enabled: boolean;
  beta: boolean;
  mock: boolean;
}

const appOAuthProviders = {
  amazon: {
    name: 'Amazon',
    developers: 'https://developer.amazon.com/apps-and-games/services-and-apis',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  apple: {
    name: 'Apple',
    developers: 'https://developer.apple.com/',
    enabled: true,
    sandbox: false,
    beta: true,
    mock: false,
  },
  auth0: {
    name: 'Auth0',
    developers: 'https://auth0.com/developers',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  authentik: {
    name: 'Authentik',
    developers: 'https://goauthentik.io/docs/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  autodesk: {
    name: 'Autodesk',
    developers:
      'https://forge.autodesk.com/en/docs/oauth/v2/developers_guide/overview/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  bitbucket: {
    name: 'BitBucket',
    developers: 'https://developer.atlassian.com/bitbucket',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  bitly: {
    name: 'Bitly',
    developers: 'https://dev.bitly.com/v4_documentation.html',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  box: {
    name: 'Box',
    developers: 'https://developer.box.com/reference/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  dailymotion: {
    name: 'Dailymotion',
    developers: 'https://developers.dailymotion.com/api/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  discord: {
    name: 'Discord',
    developers: 'https://discordapp.com/developers/docs/topics/oauth2',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  disqus: {
    name: 'Disqus',
    developers: 'https://disqus.com/api/docs/auth/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  dropbox: {
    name: 'Dropbox',
    developers: 'https://www.dropbox.com/developers/documentation',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  etsy: {
    name: 'Etsy',
    developers: 'https://developers.etsy.com/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  facebook: {
    name: 'Facebook',
    developers: 'https://developers.facebook.com/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  github: {
    name: 'GitHub',
    developers: 'https://developer.github.com/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  gitlab: {
    name: 'GitLab',
    developers: 'https://docs.gitlab.com/ee/api/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  google: {
    name: 'Google',
    developers: 'https://support.google.com/googleapi/answer/6158849',
    enabled: true,
    sandbox: false,
    beta: false,
    mock: false,
  },
  linkedin: {
    name: 'LinkedIn',
    developers: 'https://developer.linkedin.com/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  microsoft: {
    name: 'Microsoft',
    developers: 'https://developer.microsoft.com/en-us/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  notion: {
    name: 'Notion',
    developers: 'https://developers.notion.com/docs',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  oidc: {
    name: 'OpenID Connect',
    developers: 'https://openid.net/connect/faq/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  okta: {
    name: 'Okta',
    developers: 'https://developer.okta.com/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  paypal: {
    name: 'PayPal',
    developers: 'https://developer.paypal.com/docs/api/overview/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  paypalSandbox: {
    name: 'PayPal Sandbox',
    developers: 'https://developer.paypal.com/docs/api/overview/',
    enabled: false,
    sandbox: true,
    beta: false,
    mock: false,
  },
  podio: {
    name: 'Podio',
    developers: 'https://developers.podio.com/doc/oauth-authorization',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  salesforce: {
    name: 'Salesforce',
    developers: 'https://developer.salesforce.com/docs/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  slack: {
    name: 'Slack',
    developers: 'https://api.slack.com/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  spotify: {
    name: 'Spotify',
    developers:
      'https://developer.spotify.com/documentation/general/guides/authorization-guide/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  stripe: {
    name: 'Stripe',
    developers: 'https://stripe.com/docs/api',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  tradeshift: {
    name: 'Tradeshift',
    developers: 'https://developers.tradeshift.com/docs/api',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  tradeshiftBox: {
    name: 'Tradeshift Sandbox',
    developers: 'https://developers.tradeshift.com/docs/api',
    enabled: false,
    sandbox: true,
    beta: false,
    mock: false,
  },
  twitch: {
    name: 'Twitch',
    developers: 'https://dev.twitch.tv/docs/authentication',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  wordpress: {
    name: 'WordPress',
    developers: 'https://developer.wordpress.com/docs/oauth2/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  yahoo: {
    name: 'Yahoo',
    developers: 'https://developer.yahoo.com/oauth2/guide/flows_authcode/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  yammer: {
    name: 'Yammer',
    developers: 'https://docs.microsoft.com/en-us/rest/api/yammer/oauth-2/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  yandex: {
    name: 'Yandex',
    developers: 'https://tech.yandex.com/oauth/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  zoho: {
    name: 'Zoho',
    developers: 'https://zoho.com/accounts/protocol/oauth.html',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  zoom: {
    name: 'Zoom',
    developers: 'https://marketplace.zoom.us/docs/guides/auth/oauth/',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: false,
  },
  mock: {
    name: 'Mock',
    developers: 'https://nuvix.in',
    enabled: false,
    sandbox: false,
    beta: false,
    mock: true,
  },
} as const;

export const oAuthProviders: Record<
  keyof typeof appOAuthProviders,
  OAuthProvider
> = appOAuthProviders;

export const oAuthProvidersList = Object.entries(oAuthProviders)
  .filter(([_, provider]) => provider.enabled)
  .map(([name]) => name) as (keyof typeof oAuthProviders)[];

export type OAuthProviders = (typeof oAuthProvidersList)[number];

export type OAuthProviderType = {
  key: string;
  name: string;
  enabled: boolean;
  appId: string;
  secret: string;
};
