import { Client } from "@nuvix/client";

const nx = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const result = nx.avatars.getQR(
    '<TEXT>', // text
    1, // size (optional)
    0, // margin (optional)
    false // download (optional)
);

console.log(result);
