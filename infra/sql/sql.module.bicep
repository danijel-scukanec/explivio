@description('The location for the resource(s) to be deployed.')
param location string = resourceGroup().location

resource sqlServerAdminManagedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: take('sql-admin-${uniqueString(resourceGroup().id)}', 63)
  location: location
}

resource sql 'Microsoft.Sql/servers@2023-08-01' = {
  name: take('sql-${uniqueString(resourceGroup().id)}', 63)
  location: location
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      login: sqlServerAdminManagedIdentity.name
      sid: sqlServerAdminManagedIdentity.properties.principalId
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: true
    }
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    version: '12.0'
  }
  tags: {
    'aspire-resource-name': 'sql'
  }
}

resource sqlFirewallRule_AllowAllAzureIps 'Microsoft.Sql/servers/firewallRules@2023-08-01' = {
  name: 'AllowAllAzureIps'
  properties: {
    endIpAddress: '0.0.0.0'
    startIpAddress: '0.0.0.0'
  }
  parent: sql
}

// Basic DTU tier (~€5/mo, 2 GB, always-on). Deliberately NOT the serverless free offer
// (GP_S_Gen5 + useFreeLimit): that offer grants 100k vCore-seconds/month and auto-PAUSES for the rest
// of the month once spent, which it did — the app's 5s outbox polling keeps the DB warm so it never
// idles into a pause and burns the grant in ~1-3 days, then every DB-backed endpoint 500s. Basic is
// fixed-price and never pauses. (Azure also refuses to downgrade a paid DB back to the free offer, so
// this must stay Basic to match the live DB.)
resource sqlserver 'Microsoft.Sql/servers/databases@2023-08-01' = {
  name: 'Explivio'
  location: location
  properties: {
    maxSizeBytes: 2147483648
  }
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  parent: sql
}

output sqlServerFqdn string = sql.properties.fullyQualifiedDomainName

output name string = sql.name

output id string = sql.id

output sqlServerAdminName string = sql.properties.administrators.login