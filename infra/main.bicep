targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment that can be used as part of naming resource convention, the name of the resource group for your application will use this name, prefixed with rg-')
param environmentName string

@minLength(1)
@description('The location used for all deployed resources')
param location string

@description('Id of the user or app to assign application roles')
param principalId string = ''


var tags = {
  'azd-env-name': environmentName
}

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}
module resources 'resources.bicep' = {
  scope: rg
  name: 'resources'
  params: {
    location: location
    tags: tags
    principalId: principalId
  }
}

module appinsights 'appinsights/appinsights.module.bicep' = {
  name: 'appinsights'
  scope: rg
  params: {
    location: location
  }
}
module cosmos 'cosmos/cosmos.module.bicep' = {
  name: 'cosmos'
  scope: rg
  params: {
    location: location
  }
}
module cosmos_roles 'cosmos-roles/cosmos-roles.module.bicep' = {
  name: 'cosmos-roles'
  scope: rg
  params: {
    cosmos_outputs_name: cosmos.outputs.name
    location: location
    principalId: resources.outputs.MANAGED_IDENTITY_PRINCIPAL_ID
  }
}
module messaging 'messaging/messaging.module.bicep' = {
  name: 'messaging'
  scope: rg
  params: {
    location: location
  }
}
module messaging_roles 'messaging-roles/messaging-roles.module.bicep' = {
  name: 'messaging-roles'
  scope: rg
  params: {
    location: location
    messaging_outputs_name: messaging.outputs.name
    principalId: resources.outputs.MANAGED_IDENTITY_PRINCIPAL_ID
    principalType: 'ServicePrincipal'
  }
}
module sql 'sql/sql.module.bicep' = {
  name: 'sql'
  scope: rg
  params: {
    location: location
  }
}
module sql_roles 'sql-roles/sql-roles.module.bicep' = {
  name: 'sql-roles'
  scope: rg
  params: {
    location: location
    principalId: resources.outputs.MANAGED_IDENTITY_PRINCIPAL_ID
    principalName: resources.outputs.MANAGED_IDENTITY_NAME
    principalType: 'ServicePrincipal'
    sql_outputs_name: sql.outputs.name
    sql_outputs_sqlserveradminname: sql.outputs.sqlServerAdminName
  }
}
module signalr 'signalr/signalr.module.bicep' = {
  name: 'signalr'
  scope: rg
  params: {
    location: location
  }
}
module signalr_roles 'signalr-roles/signalr-roles.module.bicep' = {
  name: 'signalr-roles'
  scope: rg
  params: {
    location: location
    principalId: resources.outputs.MANAGED_IDENTITY_PRINCIPAL_ID
    principalType: 'ServicePrincipal'
    signalr_outputs_name: signalr.outputs.name
  }
}
module storage 'storage/storage.module.bicep' = {
  name: 'storage'
  scope: rg
  params: {
    location: location
  }
}
module storage_roles 'storage-roles/storage-roles.module.bicep' = {
  name: 'storage-roles'
  scope: rg
  params: {
    location: location
    principalId: resources.outputs.MANAGED_IDENTITY_PRINCIPAL_ID
    principalType: 'ServicePrincipal'
    storage_outputs_name: storage.outputs.name
  }
}

output MANAGED_IDENTITY_CLIENT_ID string = resources.outputs.MANAGED_IDENTITY_CLIENT_ID
output MANAGED_IDENTITY_NAME string = resources.outputs.MANAGED_IDENTITY_NAME
output AZURE_LOG_ANALYTICS_WORKSPACE_NAME string = resources.outputs.AZURE_LOG_ANALYTICS_WORKSPACE_NAME
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.AZURE_CONTAINER_REGISTRY_ENDPOINT
output AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID string = resources.outputs.AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID
output AZURE_CONTAINER_REGISTRY_NAME string = resources.outputs.AZURE_CONTAINER_REGISTRY_NAME
output AZURE_CONTAINER_APPS_ENVIRONMENT_NAME string = resources.outputs.AZURE_CONTAINER_APPS_ENVIRONMENT_NAME
output AZURE_CONTAINER_APPS_ENVIRONMENT_ID string = resources.outputs.AZURE_CONTAINER_APPS_ENVIRONMENT_ID
output AZURE_CONTAINER_APPS_ENVIRONMENT_DEFAULT_DOMAIN string = resources.outputs.AZURE_CONTAINER_APPS_ENVIRONMENT_DEFAULT_DOMAIN
output APPINSIGHTS_APPINSIGHTSCONNECTIONSTRING string = appinsights.outputs.appInsightsConnectionString
output COSMOS_CONNECTIONSTRING string = cosmos.outputs.connectionString
output MESSAGING_SERVICEBUSENDPOINT string = messaging.outputs.serviceBusEndpoint
output MESSAGING_SERVICEBUSHOSTNAME string = messaging.outputs.serviceBusHostName
output SQL_SQLSERVERFQDN string = sql.outputs.sqlServerFqdn
output STORAGE_BLOBENDPOINT string = storage.outputs.blobEndpoint
output SIGNALR_HOSTNAME string = signalr.outputs.hostName
