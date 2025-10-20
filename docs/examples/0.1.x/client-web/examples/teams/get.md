import { Client, Teams } from "@nuvix/client";

const client = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const teams = new Teams(client);

const result = await teams.get(
    '<TEAM_ID>' // teamId
);

console.log(result);
