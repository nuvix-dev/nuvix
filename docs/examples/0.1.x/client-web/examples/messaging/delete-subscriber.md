import { Client, Messaging } from "@nuvix/client";

const client = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const messaging = new Messaging(client);

const result = await messaging.deleteSubscriber(
    '<TOPIC_ID>', // topicId
    '<SUBSCRIBER_ID>' // subscriberId
);

console.log(result);
