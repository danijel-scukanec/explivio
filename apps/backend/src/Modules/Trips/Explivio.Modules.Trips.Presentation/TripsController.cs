using Explivio.Modules.Trips.Application.UseCases.Commands.CreateTrip;
using Explivio.Modules.Trips.Presentation.Trips;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Explivio.Modules.Trips.Presentation;

[ApiController]
[Route("api/trips")]
public sealed class TripsController : ControllerBase
{
    private readonly ISender _sender;
    public TripsController(ISender sender) => _sender = sender;

    [HttpPost]
    public async Task<ActionResult<Guid>> Create([FromBody] CreateTripRequest req, CancellationToken ct)
    {
        var id = await _sender.Send(
            new CreateTripCommand(req.Title, req.Description, req.StartDate, req.EndDate),
            ct);

        return CreatedAtAction(nameof(GetById), new { tripId = id }, id);
    }
    
    [HttpGet("{tripId:guid}")]
    public async Task<ActionResult> GetById(Guid tripId, CancellationToken ct) => Ok();
}