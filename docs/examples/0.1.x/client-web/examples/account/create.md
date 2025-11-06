import { Client } from "@nuvix/client";

const nx = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const result = await nx.account.create(
    '<USER_ID>', // userId
    'email@example.com', // email
    '', // password
    '<NAME>' // name (optional)
);

console.log(result);
