import { Client } from "@nuvix/client";

const nx = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const result = await nx.storage.updateFile(
    '<BUCKET_ID>', // bucketId
    '<FILE_ID>', // fileId
    '<NAME>', // name (optional)
    ["read("any")"] // permissions (optional)
);

console.log(result);
