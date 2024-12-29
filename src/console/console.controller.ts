import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ConsoleService } from './console.service';

@Controller()
export class ConsoleController {
  constructor(private readonly consoleService: ConsoleService) { }

  @Get('variables')
  async getVariables(@Res() res) {
    return res.json({
      "_APP_DOMAIN_TARGET": "nuvix-console.vercel.app",
      "_APP_STORAGE_LIMIT": 5368709120,
      "_APP_FUNCTIONS_SIZE_LIMIT": 30000000,
      "_APP_USAGE_STATS": "enabled",
      "_APP_VCS_ENABLED": true,
      "_APP_DOMAIN_ENABLED": true,
      "_APP_ASSISTANT_ENABLED": false
    }).status(200);
  }

  @Get('plans')
  async getPlans(@Res() res) {
    return res.json({
      "total": 3,
      "plans": [
        {
          "$id": "tier-0",
          "name": "Free",
          "price": 0,
          "trial": 0,
          "bandwidth": 5,
          "storage": 2,
          "members": 1,
          "webhooks": 2,
          "platforms": 3,
          "users": 75000,
          "teams": 100,
          "databases": 1,
          "buckets": 3,
          "fileSize": 50,
          "functions": 5,
          "executions": 750000,
          "realtime": 250,
          "logs": 1,
          "addons": [],
          "customSmtp": false,
          "emailBranding": true,
          "requiresPaymentMethod": false,
          "requiresBillingAddress": false,
          "isAvailable": true,
          "selfService": true,
          "premiumSupport": false,
          "budgeting": false,
          "supportsMockNumbers": false,
          "backupsEnabled": false,
          "backupPolicies": -1
        },
        {
          "$id": "tier-1",
          "name": "Pro",
          "price": 15,
          "trial": 0,
          "bandwidth": 300,
          "storage": 150,
          "members": 0,
          "webhooks": 0,
          "platforms": 0,
          "users": 200000,
          "teams": 0,
          "databases": 0,
          "buckets": 0,
          "fileSize": 5000,
          "functions": 0,
          "executions": 3500000,
          "realtime": 500,
          "logs": 168,
          "addons": {
            "bandwidth": {
              "unit": "GB",
              "price": 40,
              "currency": "USD",
              "value": 100,
              "multiplier": 1000000000,
              "invoiceDesc": "Calculated for all bandwidth used."
            },
            "storage": {
              "unit": "GB",
              "price": 3,
              "currency": "USD",
              "value": 100,
              "multiplier": 1000000000,
              "invoiceDesc": "Calculated for all compute operations (incl. functions builds, functions executions, hosting builds, and video transcoding time)."
            },
            "member": {
              "unit": "",
              "price": 15,
              "currency": "USD",
              "value": 1,
              "invoiceDesc": "Per additional member"
            },
            "users": {
              "unit": "",
              "price": 0,
              "currency": "USD",
              "value": 1000,
              "invoiceDesc": "Active users across all projects in your organization."
            },
            "executions": {
              "unit": "",
              "price": 2,
              "currency": "USD",
              "value": 1000000,
              "invoiceDesc": "Calculated for all functions executed in your organization"
            },
            "realtime": {
              "unit": "",
              "price": 5,
              "currency": "USD",
              "value": 1000,
              "invoiceDesc": "Calculated for all realtime concurrent connections sent to the projects in your organization."
            }
          },
          "customSmtp": true,
          "emailBranding": false,
          "requiresPaymentMethod": true,
          "requiresBillingAddress": false,
          "isAvailable": true,
          "selfService": true,
          "premiumSupport": true,
          "budgeting": true,
          "supportsMockNumbers": true,
          "backupsEnabled": true,
          "backupPolicies": 1
        },
      ]
    }).status(200);
  }

  @Get('regions')
  async getRegions(@Res() res) {
    return res.json({
      "total": 10,
      "regions": [
        {
          "$id": "default",
          "name": "Frankfurt",
          "disabled": false,
          "default": true,
          "flag": "de"
        },
        {
          "$id": "fra",
          "name": "Frankfurt",
          "disabled": false,
          "default": true,
          "flag": "de"
        },
        {
          "$id": "nyc",
          "name": "New York",
          "disabled": true,
          "default": true,
          "flag": "us"
        },
        {
          "$id": "sfo",
          "name": "San Francisco",
          "disabled": true,
          "default": true,
          "flag": "us"
        },
        {
          "$id": "blr",
          "name": "Banglore",
          "disabled": true,
          "default": true,
          "flag": "in"
        },
        {
          "$id": "lon",
          "name": "London",
          "disabled": true,
          "default": true,
          "flag": "gb"
        },
        {
          "$id": "ams",
          "name": "Amsterdam",
          "disabled": true,
          "default": true,
          "flag": "nl"
        },
        {
          "$id": "sgp",
          "name": "Singapore",
          "disabled": true,
          "default": true,
          "flag": "sg"
        },
        {
          "$id": "tor",
          "name": "Toronto",
          "disabled": true,
          "default": true,
          "flag": "ca"
        },
        {
          "$id": "syd",
          "name": "Sydney",
          "disabled": true,
          "default": true,
          "flag": "au"
        }
      ]
    }).status(200);
  }

  @Post('sources')
  async getSources(@Res() res, @Body() input) {
    return res.json({}).status(200);
  }
}
