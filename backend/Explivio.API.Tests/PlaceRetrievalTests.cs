using Explivio.API.Infrastructure.Rag;
using Xunit;

namespace Explivio.API.Tests;

// F14: exercises the RAG retrieval layer against the deterministic fake embedder and the seeded
// corpus — no Cosmos, no credentials. Proves the corpus loads, destination filtering works, and
// similarity ranking surfaces the semantically relevant places first.
public sealed class PlaceRetrievalTests
{
    private static InMemoryPlaceRetriever Retriever() =>
        new(new PlaceCorpus(), new FakePlaceEmbeddingGenerator());

    [Fact]
    public void Corpus_LoadsSeededPlaces_WithStableIds()
    {
        var corpus = new PlaceCorpus();

        Assert.NotEmpty(corpus.Places);
        Assert.All(corpus.Places, p => Assert.False(string.IsNullOrWhiteSpace(p.Id)));
        // Ids are a stable slug, so re-seeding Cosmos is an idempotent upsert.
        Assert.Contains(corpus.Places, p => p.Id == "paris-louvre-museum");
    }

    [Fact]
    public async Task Retrieve_FiltersToDestination()
    {
        var matches = await Retriever().RetrieveAsync("Lisbon, Portugal", "things to do", 10, CancellationToken.None);

        Assert.NotEmpty(matches);
        // Every match must be a Lisbon place — Paris/Rome/etc. are filtered out by destination.
        var lisbonNames = new[] { "Belém Tower", "Jerónimos Monastery", "Time Out Market", "Tram 28", "Alfama District", "Pastéis de Belém" };
        Assert.All(matches, m => Assert.Contains(m.Name, lisbonNames));
    }

    [Fact]
    public async Task Retrieve_RanksSemanticallyRelevantPlacesFirst()
    {
        // A food-oriented query should surface the food places above the sightseeing ones.
        var matches = await Retriever().RetrieveAsync("Lisbon", "best food market and local cuisine to eat", 2, CancellationToken.None);

        Assert.Equal(2, matches.Count);
        Assert.Contains(matches, m => m.Category == "Food");
    }

    [Fact]
    public async Task Retrieve_UnknownDestination_ReturnsEmpty()
    {
        var matches = await Retriever().RetrieveAsync("Narnia", "anything", 5, CancellationToken.None);

        Assert.Empty(matches);
    }

    [Fact]
    public async Task FakeEmbeddings_AreDeterministic_AndCorrectWidth()
    {
        var generator = new FakePlaceEmbeddingGenerator();

        var first = await generator.GenerateAsync(["a lively food market"], cancellationToken: CancellationToken.None);
        var second = await generator.GenerateAsync(["a lively food market"], cancellationToken: CancellationToken.None);
        var a = first[0].Vector.ToArray();
        var b = second[0].Vector.ToArray();

        Assert.Equal(RagConstants.EmbeddingDimensions, a.Length);
        Assert.Equal(a, b);
    }
}
