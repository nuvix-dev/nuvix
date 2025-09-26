import { Client, Avatars, Flag } from "nuvix";

const client = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const avatars = new Avatars(client);

const result = avatars.getFlag(
    Flag.Afghanistan, // code
    0, // width (optional)
    0, // height (optional)
    -1 // quality (optional)
);

console.log(result);
