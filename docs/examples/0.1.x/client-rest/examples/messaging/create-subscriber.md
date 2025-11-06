POST /v1/messaging/topics/{topicId}/subscribers HTTP/1.1
Host: api.nuvix.in
Content-Type: application/json
X-Nuvix-Project: <YOUR_PROJECT_ID>
X-Nuvix-JWT: <YOUR_JWT>
X-Nuvix-Session: 

{
  "subscriberId": "<SUBSCRIBER_ID>",
  "targetId": "<TARGET_ID>"
}
