PUT /v1/account/mfa/authenticators/{type} HTTP/1.1
Host: api.nuvix.in
Content-Type: application/json
X-Nuvix-Project: <YOUR_PROJECT_ID>
X-Nuvix-Session: 
X-Nuvix-JWT: <YOUR_JWT>

{
  "otp": "<OTP>"
}
