POST /v1/account/sessions/token HTTP/1.1
Host: api.nuvix.in
Content-Type: application/json
X-Nuvix-Response-Format: 1.7.0
X-Nuvix-Project: <YOUR_PROJECT_ID>

{
  "userId": "<USER_ID>",
  "secret": "<SECRET>"
}
