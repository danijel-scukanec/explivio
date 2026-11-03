namespace Explivio.NotificationsWorker.Pushing;

// F20 (push): turns a notification's Kind + Detail into the push title and body. The title is the trip
// name; the body mirrors the in-app client's wording (notifications.kind.* strings), appending the
// detail when present. Built server-side in English — the recipient's device locale isn't known at send
// time, so localized push text is a follow-up (a key the client translates, or per-device locale).
public static class PushMessageText
{
    public static (string Title, string Body) For(string tripName, string kind, string? detail)
    {
        var phrase = kind switch
        {
            "ActivityAdded" => "Added an activity",
            "ActivityRemoved" => "Removed an activity",
            "ExpenseAdded" => "Added an expense",
            "ExpenseRemoved" => "Removed an expense",
            "StatusChanged" => "Changed the trip status",
            _ => "Updated the trip",
        };

        var body = string.IsNullOrWhiteSpace(detail) ? phrase : $"{phrase}: {detail}";
        var title = string.IsNullOrWhiteSpace(tripName) ? "Trip update" : tripName;
        return (title, body);
    }
}
