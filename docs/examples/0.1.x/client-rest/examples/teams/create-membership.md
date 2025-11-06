POST /v1/teams/{teamId}/memberships HTTP/1.1
Host: api.nuvix.in
Content-Type: application/json
X-Nuvix-Project: <YOUR_PROJECT_ID>
X-Nuvix-Session: 
X-Nuvix-JWT: <YOUR_JWT>

{
  "email": "email@example.com",
  "userId": "<USER_ID>",
  "phone": "+12065550100",
  "roles": [],
  "url": "https://example.com",
  "name": "<NAME>"
}
