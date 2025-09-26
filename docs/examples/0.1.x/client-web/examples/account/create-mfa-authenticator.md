import { Client, Account, AuthenticatorType } from "nuvix";

const client = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const account = new Account(client);

const result = await account.createMfaAuthenticator(
    AuthenticatorType.Totp // type
);

console.log(result);
