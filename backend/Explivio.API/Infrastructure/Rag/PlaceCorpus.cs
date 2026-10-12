using System.Reflection;
using System.Text.Json;

namespace Explivio.API.Infrastructure.Rag;

// F14: loads the seed place corpus from the embedded places.seed.json. This is the small, curated,
// offline dataset the RAG features ground against — it keeps the demo self-contained (no external
// place API or account needed). Both the Cosmos seeder and the in-memory retriever read from here.
public sealed class PlaceCorpus
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly Lazy<IReadOnlyList<Place>> places = new(Load);

    public IReadOnlyList<Place> Places => places.Value;

    private static IReadOnlyList<Place> Load()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = assembly.GetManifestResourceNames()
            .Single(n => n.EndsWith("places.seed.json", StringComparison.Ordinal));

        using var stream = assembly.GetManifestResourceStream(resourceName)!;
        var seed = JsonSerializer.Deserialize<List<Place>>(stream, JsonOptions) ?? [];

        foreach (var place in seed)
        {
            // A stable id so re-seeding Cosmos is an idempotent upsert rather than a duplicate insert.
            place.Id = Slug($"{place.Destination}-{place.Name}");
        }

        return seed;
    }

    private static string Slug(string value) =>
        string.Concat(value.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-'));
}
