using Microsoft.Azure.Cosmos;

namespace Explivio.API.Infrastructure.Cosmos;

public class CosmosRepository(CosmosClient client, IConfiguration configuration)
{
    private readonly string _databaseName = configuration["CosmosDb:DatabaseName"] ?? "explivio";

    public async Task<T?> GetAsync<T>(string containerId, string id, string partitionKey)
    {
        var container = client.GetContainer(_databaseName, containerId);
        try
        {
            var response = await container.ReadItemAsync<T>(id, new PartitionKey(partitionKey));
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return default;
        }
    }

    public async Task<T> UpsertAsync<T>(string containerId, T item, string partitionKey)
    {
        var container = client.GetContainer(_databaseName, containerId);
        var response = await container.UpsertItemAsync(item, new PartitionKey(partitionKey));
        return response.Resource;
    }

    public async Task DeleteAsync(string containerId, string id, string partitionKey)
    {
        var container = client.GetContainer(_databaseName, containerId);
        await container.DeleteItemAsync<object>(id, new PartitionKey(partitionKey));
    }

    public IQueryable<T> GetQueryable<T>(string containerId)
    {
        var container = client.GetContainer(_databaseName, containerId);
        return container.GetItemLinqQueryable<T>(allowSynchronousQueryExecution: true);
    }
}
