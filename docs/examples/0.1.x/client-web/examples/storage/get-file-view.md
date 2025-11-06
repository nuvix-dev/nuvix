import { Client } from "@nuvix/client";

const nx = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const result = nx.storage.getFileView(
    '<BUCKET_ID>', // bucketId
    '<FILE_ID>', // fileId
    '<TOKEN>' // token (optional)
);

console.log(result);
