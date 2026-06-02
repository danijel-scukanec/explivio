param location string = resourceGroup().location
param appName string = 'explivio'
param environment string = 'dev'

var suffix = '${appName}-${environment}'

module sql 'modules/sql.bicep' = {
  name: 'sql'
  params: {
    location: location
    suffix: suffix
  }
}

module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    location: location
    suffix: suffix
  }
}

module appService 'modules/appservice.bicep' = {
  name: 'appservice'
  params: {
    location: location
    suffix: suffix
    sqlConnectionString: sql.outputs.connectionString
    cosmosConnectionString: cosmos.outputs.connectionString
  }
}

module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'staticwebapp'
  params: {
    location: location
    suffix: suffix
  }
}
