POST /v1/account/recovery HTTP/1.1
Host: api.nuvix.in
Content-Type: application/json
X-Nuvix-Response-Format: 1.7.0
X-Nuvix-Project: <YOUR_PROJECT_ID>
X-Nuvix-Session: 
X-Nuvix-JWT: <YOUR_JWT>

{
  "email": "email@example.com",
  "url": "https://example.com"
}
