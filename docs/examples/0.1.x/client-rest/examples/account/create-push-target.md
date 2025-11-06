POST /v1/account/targets/push HTTP/1.1
Host: api.nuvix.in
Content-Type: application/json
X-Nuvix-Project: <YOUR_PROJECT_ID>
X-Nuvix-Session: 

{
  "targetId": "<TARGET_ID>",
  "identifier": "<IDENTIFIER>",
  "providerId": "<PROVIDER_ID>"
}
