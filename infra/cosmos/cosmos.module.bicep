@description('The location for the resource(s) to be deployed.')
param location string = resourceGroup().location

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-08-15' = {
  name: take('cosmos-${uniqueString(resourceGroup().id)}', 44)
  location: location
  properties: {
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
      {
        // F14 RAG: required for the vector-indexed 'places' container below. The account is AAD-only
        // (disableLocalAuth), so the app can't create a container at runtime (data-plane RBAC can't do
        // DDL) — the container must be declared here in the control plane.
        name: 'EnableNoSQLVectorSearch'
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    databaseAccountOfferType: 'Standard'
    disableLocalAuth: true
  }
  kind: 'GlobalDocumentDB'
  tags: {
    'aspire-resource-name': 'cosmos'
  }
}

resource explivio 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-08-15' = {
  name: 'explivio'
  location: location
  properties: {
    resource: {
      id: 'explivio'
    }
  }
  parent: cosmos
}

// F14 RAG: the 'places' vector store. PlaceSeeder embeds + upserts items at startup (a data-plane
// write its managed identity is allowed), but creating the container is a control-plane op the
// AAD-only account denies at runtime — so it is declared here with its vector embedding policy and
// DiskANN index (1536-dim cosine, matching RagConstants.EmbeddingDimensions / the embedding model).
resource places 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-08-15' = {
  name: 'places'
  location: location
  properties: {
    resource: {
      id: 'places'
      partitionKey: {
        paths: [
          '/destination'
        ]
        kind: 'Hash'
      }
      vectorEmbeddingPolicy: {
        vectorEmbeddings: [
          {
            path: '/embedding'
            dataType: 'float32'
            distanceFunction: 'cosine'
            dimensions: 1536
          }
        ]
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/embedding/*'
          }
        ]
        vectorIndexes: [
          {
            path: '/embedding'
            type: 'diskANN'
          }
        ]
      }
    }
  }
  parent: explivio
}

output connectionString string = cosmos.properties.documentEndpoint

output name string = cosmos.name

output id string = cosmos.id