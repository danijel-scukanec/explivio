using System.Collections.ObjectModel;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.AI;
using CosmosVectorEmbedding = Microsoft.Azure.Cosmos.Embedding;

namespace Explivio.API.Infrastructure.Rag;

// F14: on startup, ensures the Cosmos "places" container exists with a vector embedding policy +
// DiskANN index, then embeds and upserts the seed corpus if the container is empty. Owning the
// container creation here (rather than in the AppHost) is what lets us declare the vector policy,
// and it works the same locally against the preview emulator and in Azure. Idempotent: stable ids
// mean re-seeding upserts, and an already-populated container is left alone. Retried briefly to
// tolerate the emulator still warming up — the same posture as the EF migrate-on-startup.
public sealed class PlaceSeeder(
    CosmosClient client,
    PlaceCorpus corpus,
    IEmbeddingGenerator<string, Embedding<float>> embeddingGenerator,
    ILogger<PlaceSeeder> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        for (var attempt = 1; attempt <= 10; attempt++)
        {
            try
            {
                var container = await EnsureContainerAsync(stoppingToken);
                await SeedIfEmptyAsync(container, stoppingToken);
                return;
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception ex) when (attempt < 10)
            {
                logger.LogWarning(ex, "Place seeding attempt {Attempt} failed; retrying.", attempt);
                await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
            }
        }
    }

    private async Task<Container> EnsureContainerAsync(CancellationToken cancellationToken)
    {
        var database = await client.CreateDatabaseIfNotExistsAsync(
            RagConstants.DatabaseName, cancellationToken: cancellationToken);

        var properties = new ContainerProperties(RagConstants.PlacesContainer, "/destination")
        {
            VectorEmbeddingPolicy = new VectorEmbeddingPolicy(new Collection<CosmosVectorEmbedding>
            {
                new()
                {
                    Path = "/embedding",
                    DataType = VectorDataType.Float32,
                    DistanceFunction = DistanceFunction.Cosine,
                    Dimensions = RagConstants.EmbeddingDimensions,
                },
            }),
            IndexingPolicy = new IndexingPolicy
            {
                VectorIndexes =
                {
                    new VectorIndexPath { Path = "/embedding", Type = VectorIndexType.DiskANN },
                },
            },
        };

        // The raw vector is large and never filtered on directly, so keep it out of the normal index.
        properties.IndexingPolicy.ExcludedPaths.Add(new ExcludedPath { Path = "/embedding/*" });

        var response = await database.Database.CreateContainerIfNotExistsAsync(
            properties, cancellationToken: cancellationToken);
        return response.Container;
    }

    private async Task SeedIfEmptyAsync(Container container, CancellationToken cancellationToken)
    {
        var count = await CountAsync(container, cancellationToken);
        if (count > 0)
        {
            logger.LogInformation("Place corpus already seeded ({Count} places); skipping.", count);
            return;
        }

        var places = corpus.Places;
        var vectors = await embeddingGenerator.GenerateAsync(
            places.Select(p => p.Text), cancellationToken: cancellationToken);

        for (var i = 0; i < places.Count; i++)
        {
            places[i].Embedding = vectors[i].Vector.ToArray();
            await container.UpsertItemAsync(
                places[i], new PartitionKey(places[i].Destination), cancellationToken: cancellationToken);
        }

        logger.LogInformation("Seeded {Count} places into Cosmos vector store.", places.Count);
    }

    private static async Task<int> CountAsync(Container container, CancellationToken cancellationToken)
    {
        using var iterator = container.GetItemQueryIterator<int>(new QueryDefinition("SELECT VALUE COUNT(1) FROM c"));
        if (!iterator.HasMoreResults)
        {
            return 0;
        }

        var page = await iterator.ReadNextAsync(cancellationToken);
        return page.FirstOrDefault();
    }
}
