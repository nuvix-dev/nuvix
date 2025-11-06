import { Client } from "@nuvix/client";

const nx = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const result = await nx.teams.createMembership(
    '<TEAM_ID>', // teamId
    [], // roles
    'email@example.com', // email (optional)
    '<USER_ID>', // userId (optional)
    '+12065550100', // phone (optional)
    'https://example.com', // url (optional)
    '<NAME>' // name (optional)
);

console.log(result);
