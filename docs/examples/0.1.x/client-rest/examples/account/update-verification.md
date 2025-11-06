PUT /v1/account/verification HTTP/1.1
Host: api.nuvix.in
Content-Type: application/json
X-Nuvix-Project: <YOUR_PROJECT_ID>
X-Nuvix-Session: 
X-Nuvix-JWT: <YOUR_JWT>

{
  "userId": "<USER_ID>",
  "secret": "<SECRET>"
}
