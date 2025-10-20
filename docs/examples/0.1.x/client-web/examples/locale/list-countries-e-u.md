import { Client, Locale } from "@nuvix/client";

const client = new Client()
    .setEndpoint('https://api.nuvix.in/v1') // Your API Endpoint
    .setProject('<YOUR_PROJECT_ID>'); // Your project ID

const locale = new Locale(client);

const result = await locale.listCountriesEU();

console.log(result);
