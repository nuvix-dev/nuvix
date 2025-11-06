import { Client } from "@nuvix/client";

const nx = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const result = nx.avatars.getInitials(
    '<NAME>', // name (optional)
    0, // width (optional)
    0, // height (optional)
    '' // background (optional)
);

console.log(result);
