using Explivio.API.Infrastructure.Database;
using MediatR;

namespace Explivio.API.Modules.Itinerary.CreateActivity;

public class CreateActivityHandler(AppDbContext db) : IRequestHandler<CreateActivityCommand, Guid>
{
    public async Task<Guid> Handle(CreateActivityCommand command, CancellationToken cancellationToken)
    {
        var activity = Activity.Create(
            command.TripId,
            command.Name,
            command.Description,
            command.Location,
            command.Date,
            command.StartTime,
            command.EndTime,
            command.Category,
            command.Latitude,
            command.Longitude);

        db.Activities.Add(activity);
        await db.SaveChangesAsync(cancellationToken);

        return activity.Id;
    }
}
