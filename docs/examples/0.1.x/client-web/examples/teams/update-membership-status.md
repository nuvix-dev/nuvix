import { Client } from "@nuvix/client";

const nx = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const result = await nx.teams.updateMembershipStatus(
    '<TEAM_ID>', // teamId
    '<MEMBERSHIP_ID>', // membershipId
    '<USER_ID>', // userId
    '<SECRET>' // secret
);

console.log(result);
