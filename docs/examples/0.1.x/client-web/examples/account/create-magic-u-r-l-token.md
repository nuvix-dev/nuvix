import { Client } from "@nuvix/client";

const nx = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const result = await nx.account.createMagicURLToken(
    '<USER_ID>', // userId
    'email@example.com', // email
    'https://example.com', // url (optional)
    false // phrase (optional)
);

console.log(result);
