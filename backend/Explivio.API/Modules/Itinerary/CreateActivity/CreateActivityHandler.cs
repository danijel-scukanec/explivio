using Explivio.API.Infrastructure.Database;
using MediatR;

namespace Explivio.API.Modules.Itinerary.CreateActivity;

public class CreateActivityHandler(AppDbContext db) : IRequestHandler<CreateActivityCommand, Guid>
{
    public async Task<Guid> Handle(CreateActivityCommand command, CancellationToken cancellationToken)
    {
        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            TripId = command.TripId,
            Name = command.Name,
            Description = command.Description,
            Location = command.Location,
            Date = command.Date,
            StartTime = command.StartTime,
            EndTime = command.EndTime,
            Category = command.Category,
            Latitude = command.Latitude,
            Longitude = command.Longitude,
            CreatedAt = DateTime.UtcNow
        };

        db.Activities.Add(activity);
        await db.SaveChangesAsync(cancellationToken);

        return activity.Id;
    }
}
