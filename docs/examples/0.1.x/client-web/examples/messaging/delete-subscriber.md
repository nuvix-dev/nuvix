import { Client } from "@nuvix/client";

const nx = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const result = await nx.messaging.deleteSubscriber(
    '<TOPIC_ID>', // topicId
    '<SUBSCRIBER_ID>' // subscriberId
);

console.log(result);
