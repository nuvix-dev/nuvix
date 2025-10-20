import { Client, Account, OAuthProvider } from "@nuvix/client";

const client = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const account = new Account(client);

account.createOAuth2Session(
    OAuthProvider.Amazon, // provider
    'https://example.com', // success (optional)
    'https://example.com', // failure (optional)
    [] // scopes (optional)
);
