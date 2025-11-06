import { Client, Flag } from "@nuvix/client";

const nx = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const result = nx.avatars.getFlag(
    Flag.Afghanistan, // code
    0, // width (optional)
    0, // height (optional)
    -1 // quality (optional)
);

console.log(result);
