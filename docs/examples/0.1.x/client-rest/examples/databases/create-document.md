POST /v1/databases/{databaseId}/collections/{collectionId}/documents HTTP/1.1
Host: api.nuvix.in
Content-Type: application/json
X-Nuvix-Response-Format: 1.7.0
X-Nuvix-Project: <YOUR_PROJECT_ID>
X-Nuvix-Session: 
X-Nuvix-JWT: <YOUR_JWT>

{
  "documentId": "<DOCUMENT_ID>",
  "data": {},
  "permissions": ["read(\"any\")"]
}
