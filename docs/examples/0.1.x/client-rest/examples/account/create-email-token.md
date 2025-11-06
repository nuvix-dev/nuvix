POST /v1/account/tokens/email HTTP/1.1
Host: api.nuvix.in
Content-Type: application/json
X-Nuvix-Project: <YOUR_PROJECT_ID>

{
  "userId": "<USER_ID>",
  "email": "email@example.com",
  "phrase": false
}
