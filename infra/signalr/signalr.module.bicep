@description('The location for the resource(s) to be deployed.')
param location string = resourceGroup().location

// F13/F15: Azure SignalR Service — the backplane for the real-time hubs so the API can scale to
// multiple Container Apps replicas (see AppHost.cs / Program.cs for why in-process SignalR breaks when
// scaled). Free tier (20 concurrent connections, 20k messages/day) keeps the "€0 at rest" posture.
// Default service mode because the API is the hub server (not Serverless). Local auth is disabled so
// the app connects with its managed identity (AuthType=azure.msi) — no keys, matching SQL/Cosmos/etc.
resource signalr 'Microsoft.SignalRService/signalR@2024-03-01' = {
  name: take('signalr-${uniqueString(resourceGroup().id)}', 63)
  location: location
  sku: {
    name: 'Free_F1'
    tier: 'Free'
    capacity: 1
  }
  kind: 'SignalR'
  identity: {
    type: 'None'
  }
  properties: {
    features: [
      {
        flag: 'ServiceMode'
        value: 'Default'
      }
    ]
    cors: {
      allowedOrigins: [
        '*'
      ]
    }
    disableLocalAuth: true
  }
  tags: {
    'aspire-resource-name': 'signalr'
  }
}

output hostName string = signalr.properties.hostName

output name string = signalr.name

output id string = signalr.id
