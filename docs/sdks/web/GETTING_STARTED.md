## Getting Started

### Add your Web Platform
For you to init your SDK and interact with Nuvix services you need to add a web platform to your project. To add a new platform, go to your Nuvix console, choose the project you created in the step before and click the 'Add Platform' button.

From the options, choose to add a **Web** platform and add your client app hostname. By adding your hostname to your project platform you are allowing cross-domain communication between your project and the Nuvix API.

### Init your SDK
Initialize your SDK with your Nuvix server API endpoint and project ID which can be found in your project settings page.

```js
// Init your Web SDK
const client = new Client();

client
    .setEndpoint('http://localhost/v1') // Your Nuvix Endpoint
    .setProject('455x34dfkj') // Your project ID
;
```

### Make Your First Request
Once your SDK object is set, access any of the Nuvix services and choose any request to send. Full documentation for any service method you would like to use can be found in your SDK documentation or in the [API References](https://docs.nuvix.in) section.

```js
const account = new Account(client);

// Register User
account.create(ID.unique(), "email@example.com", "password", "Walter O'Brien")
    .then(function (response) {
        console.log(response);
    }, function (error) {
        console.log(error);
    });

```

### Full Example
```js
// Init your Web SDK
const client = new Client();

client
    .setEndpoint('http://localhost/v1') // Your Nuvix Endpoint
    .setProject('455x34dfkj')
;

const account = new Account(client);

// Register User
account.create(ID.unique(), "email@example.com", "password", "Walter O'Brien")
    .then(function (response) {
        console.log(response);
    }, function (error) {
        console.log(error);
    });
```

### Learn more
You can use the following resources to learn more and get help
- 🚀 [Getting Started Tutorial](https://docs.nuvix.in/getting-started-for-web)
- 📜 [Nuvix Docs](https://docs.nuvix.in)
- 💬 [Discord Community](https://nuvix.io/discord)
- 🚂 [Nuvix Web Playground](https://github.com/Nuvix-Tech/playground-for-web)
