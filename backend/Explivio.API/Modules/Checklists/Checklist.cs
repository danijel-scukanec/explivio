namespace Explivio.API.Modules.Checklists;

// F24: a named checklist attached to a trip — e.g. "Packing", "To-do before flight". A trip can have
// several. Each holds an ordered set of ChecklistItems. Kept as plain entities (no domain events):
// like Reservations, this is product breadth, not part of the event-sourced read model.
public class Checklist
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation — the list's items, ordered by SortOrder. EF owns the foreign key on ChecklistItem.
    public List<ChecklistItem> Items { get; set; } = [];

    public static Checklist Create(Guid tripId, string name, int sortOrder)
    {
        return new Checklist
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            Name = name,
            SortOrder = sortOrder,
            CreatedAt = DateTime.UtcNow,
        };
    }

    public void Rename(string name) => Name = name;
}

// F24: one line in a checklist — free text plus a checked state. Ordered within its list by SortOrder.
public class ChecklistItem
{
    public Guid Id { get; set; }
    public Guid ChecklistId { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsChecked { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    public static ChecklistItem Create(Guid checklistId, string text, int sortOrder)
    {
        return new ChecklistItem
        {
            Id = Guid.NewGuid(),
            ChecklistId = checklistId,
            Text = text,
            IsChecked = false,
            SortOrder = sortOrder,
            CreatedAt = DateTime.UtcNow,
        };
    }

    public void Update(string text, bool isChecked)
    {
        Text = text;
        IsChecked = isChecked;
    }
}
