param location string
param suffix string

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: 'web-${suffix}'
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/frontend'
      outputLocation: 'dist'
    }
  }
}

output url string = 'https://${staticWebApp.properties.defaultHostname}'
