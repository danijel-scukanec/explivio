namespace Explivio.API.Infrastructure.Rag;

// F14: matches a trip's free-text destination (e.g. "Lisbon, Portugal") against a corpus place's
// normalized city (e.g. "Lisbon"). Kept lenient and in one place so both retrievers agree: a place
// matches when the trip destination contains the city name, case-insensitively.
public static class DestinationMatch
{
    public static bool Matches(string tripDestination, string placeDestination)
    {
        if (string.IsNullOrWhiteSpace(tripDestination) || string.IsNullOrWhiteSpace(placeDestination))
        {
            return false;
        }

        return tripDestination.Contains(placeDestination.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
