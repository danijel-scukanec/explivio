namespace Explivio.API.Modules.Trips.Recap;

// F29: a stored AI trip recap. One per trip (TripId is the key) — a keepsake narrative generated from
// the trip's route, itinerary and budget, kept stable across visits and replaced on regenerate. The
// text lives here (not regenerated on every read) so the summary a traveller saw stays the one they
// saved. Model records which model produced it, for display and later eval.
public class TripRecap
{
    public Guid TripId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? Model { get; set; }
    public DateTime GeneratedAtUtc { get; set; }

    // Create or replace the recap for a trip (regenerate overwrites in place).
    public void Set(string content, string? model)
    {
        Content = content;
        Model = model;
        GeneratedAtUtc = DateTime.UtcNow;
    }
}
