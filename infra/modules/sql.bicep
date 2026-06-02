param location string
param suffix string

resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: 'sql-${suffix}'
  location: location
  properties: {
    administratorLogin: 'explivio-admin'
    administratorLoginPassword: 'REPLACE_WITH_KEYVAULT_REF'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: 'explivio'
  location: location
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    capacity: 1
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: '0.5'
  }
}

output connectionString string = 'Server=${sqlServer.properties.fullyQualifiedDomainName};Database=explivio;'
