import { Client, Storage } from "@nuvix/client";

const client = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const storage = new Storage(client);

const result = await storage.deleteFile(
    '<BUCKET_ID>', // bucketId
    '<FILE_ID>' // fileId
);

console.log(result);
