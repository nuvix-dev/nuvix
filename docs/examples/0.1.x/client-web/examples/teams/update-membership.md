import { Client } from "@nuvix/client";

const nx = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const result = await nx.teams.updateMembership(
    '<TEAM_ID>', // teamId
    '<MEMBERSHIP_ID>', // membershipId
    [] // roles
);

console.log(result);
