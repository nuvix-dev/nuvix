The Databases service allows you to create structured collections of documents, query and filter lists of documents, and manage an advanced set of read and write access permissions.

All data returned by the Databases service are represented as structured JSON documents.

The Databases service can contain multiple databases, each database can contain multiple collections. A collection is a group of similarly structured documents. The accepted structure of documents is defined by [collection attributes](https://docs.nuvix.in/databases#attributes). The collection attributes help you ensure all your user-submitted data is validated and stored according to the collection structure.

Using Nuvix permissions architecture, you can assign read or write access to each collection or document in your project for either a specific user, team, user role, or even grant it with public access (`any`). You can learn more about [how Nuvix handles permissions and access control](https://docs.nuvix.in/permissions).
