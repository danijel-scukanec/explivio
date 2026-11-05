@description('The location for the resource(s) to be deployed.')
param location string = resourceGroup().location

param sku string = 'Standard'

resource messaging 'Microsoft.ServiceBus/namespaces@2024-01-01' = {
  name: take('messaging-${uniqueString(resourceGroup().id)}', 50)
  location: location
  properties: {
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
  sku: {
    name: sku
  }
  tags: {
    'aspire-resource-name': 'messaging'
  }
}

resource domain_events 'Microsoft.ServiceBus/namespaces/topics@2024-01-01' = {
  name: 'domain-events'
  parent: messaging
}

resource ai_worker 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2024-01-01' = {
  name: 'ai-worker'
  properties: {
    maxDeliveryCount: 5
  }
  parent: domain_events
}

resource notifications_worker 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2024-01-01' = {
  name: 'notifications-worker'
  properties: {
    maxDeliveryCount: 5
  }
  parent: domain_events
}

resource read_model 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2024-01-01' = {
  name: 'read-model'
  properties: {
    maxDeliveryCount: 5
  }
  parent: domain_events
}

output serviceBusEndpoint string = messaging.properties.serviceBusEndpoint

output serviceBusHostName string = split(replace(messaging.properties.serviceBusEndpoint, 'https://', ''), ':')[0]

output name string = messaging.name

output id string = messaging.id