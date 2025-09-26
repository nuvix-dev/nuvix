import { Client, Teams } from "nuvix";

const client = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const teams = new Teams(client);

const result = await teams.create(
    '<TEAM_ID>', // teamId
    '<NAME>', // name
    [] // roles (optional)
);

console.log(result);
