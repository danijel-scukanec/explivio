namespace Explivio.NotificationsWorker.Consuming.Contracts;

// F07: the worker's own copy of the event contract it consumes. Workers don't reference the API;
// they deserialize the JSON payload into a local shape matched by the Service Bus Subject (the
// event's type name). Keep the name and property names in sync with the publisher
// (Explivio.API ... TripCreatedDomainEvent). A shared contracts assembly could replace these copies
// later if the number of events grows.
public sealed record TripCreatedDomainEvent(Guid TripId, string Destination, Guid UserId);
