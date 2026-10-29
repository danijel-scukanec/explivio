using System.ComponentModel;
using System.Globalization;
using Explivio.API.Infrastructure.Database;
using Explivio.API.Modules.Budget;
using Explivio.API.Modules.Budget.AddExpense;
using Explivio.API.Modules.Itinerary.CreateActivity;
using Explivio.API.Modules.Itinerary.DeleteActivity;
using Explivio.API.Modules.Itinerary.UpdateActivity;
using Explivio.API.Modules.Trips;
using Explivio.API.Modules.Trips.SetTripStatus;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;

namespace Explivio.API.Modules.Itinerary.Assistant;

// F16: the tools the assistant can call to edit the trip. Each one dispatches an EXISTING MediatR
// command, so domain events, the outbox, F20 notifications and the F15 live-refresh broadcast all
// fire exactly as they do for the REST endpoints — the assistant is a thin driver over machinery we
// already have. Built only when the caller is Editor+ (a Viewer gets no tools; see the hub). Each
// tool runs as the authenticated user (userId) and returns a short result string the model reports.
public static class TripAssistantTools
{
    public static IList<AITool> Build(
        Guid tripId, Guid userId, DateOnly tripStart, string baseCurrency,
        IMediator mediator, AppDbContext db, CancellationToken ct)
    {
        DateOnly DayToDate(int day) => tripStart.AddDays(Math.Max(day, 1) - 1);

        var addActivity = AIFunctionFactory.Create(
            async (
                [Description("Day number within the trip, starting at 1.")] int day,
                [Description("Short activity name.")] string name,
                [Description("Optional one-line description.")] string? description,
                [Description("Category: Sightseeing, Food, Transport, Accommodation, Adventure, or Other.")] string? category,
                [Description("Optional start time as HH:mm (24-hour).")] string? startTime) =>
            {
                try
                {
                    var id = await mediator.Send(new CreateActivityCommand(
                        tripId, name, description, null, DayToDate(day),
                        ParseTime(startTime), null, ParseEnum(category, ActivityCategory.Other),
                        null, null, userId), ct);
                    return $"Added '{name}' to day {day} (id {id}).";
                }
                catch (Exception ex) { return $"Could not add the activity: {ex.Message}"; }
            },
            "add_activity",
            "Add a new activity to a day of the trip.");

        var updateActivity = AIFunctionFactory.Create(
            async (
                [Description("The activity's id (from the trip data).")] Guid activityId,
                [Description("New name, or omit to keep the current one.")] string? name,
                [Description("New day number, or omit to keep.")] int? day,
                [Description("New description, or omit to keep.")] string? description,
                [Description("New category, or omit to keep.")] string? category,
                [Description("New start time HH:mm, or omit to keep.")] string? startTime) =>
            {
                try
                {
                    var a = await db.Activities.FirstOrDefaultAsync(x => x.Id == activityId && x.TripId == tripId, ct);
                    if (a is null) return "No activity with that id on this trip.";

                    var ok = await mediator.Send(new UpdateActivityCommand(
                        tripId, activityId,
                        name ?? a.Name,
                        description ?? a.Description,
                        a.Location,
                        day.HasValue ? DayToDate(day.Value) : a.Date,
                        startTime is not null ? ParseTime(startTime) : a.StartTime,
                        a.EndTime,
                        category is not null ? ParseEnum(category, a.Category) : a.Category,
                        a.Latitude, a.Longitude), ct);
                    return ok ? $"Updated '{name ?? a.Name}'." : "No activity with that id on this trip.";
                }
                catch (Exception ex) { return $"Could not update the activity: {ex.Message}"; }
            },
            "update_activity",
            "Change fields of an existing activity; omit a field to leave it unchanged.");

        var deleteActivity = AIFunctionFactory.Create(
            async ([Description("The activity's id (from the trip data).")] Guid activityId) =>
            {
                try
                {
                    var ok = await mediator.Send(new DeleteActivityCommand(tripId, activityId, userId), ct);
                    return ok ? "Activity removed." : "No activity with that id on this trip.";
                }
                catch (Exception ex) { return $"Could not delete the activity: {ex.Message}"; }
            },
            "delete_activity",
            "Delete an activity from the trip by its id.");

        var addExpense = AIFunctionFactory.Create(
            async (
                [Description("What the expense was for.")] string description,
                [Description("Amount in the given currency.")] decimal amount,
                [Description("3-letter ISO currency code; defaults to the trip's base currency.")] string? currency,
                [Description("Category: Transport, Accommodation, Food, Activities, Shopping, or Other.")] string? category) =>
            {
                try
                {
                    var code = string.IsNullOrWhiteSpace(currency) ? baseCurrency : currency.ToUpperInvariant();
                    var id = await mediator.Send(new AddExpenseCommand(
                        tripId, description, amount, code,
                        ParseEnum(category, ExpenseCategory.Other),
                        DateOnly.FromDateTime(DateTime.UtcNow),
                        null, null, userId), ct);
                    return $"Added expense '{description}' for {amount} {code} (id {id}).";
                }
                catch (Exception ex) { return $"Could not add the expense: {ex.Message}"; }
            },
            "add_expense",
            "Add an expense to the trip budget.");

        var setStatus = AIFunctionFactory.Create(
            async ([Description("Status: Draft, Planned, Active, Completed, or Cancelled.")] string status) =>
            {
                if (!Enum.TryParse<TripStatus>(status, ignoreCase: true, out var parsed))
                    return "Unknown status. Use Draft, Planned, Active, Completed or Cancelled.";
                try
                {
                    var result = await mediator.Send(new SetTripStatusCommand(tripId, parsed, userId), ct);
                    return result.IsSuccess ? $"Trip status set to {parsed}." : "Could not change the status.";
                }
                catch (Exception ex) { return $"Could not change the status: {ex.Message}"; }
            },
            "set_trip_status",
            "Change the trip's lifecycle status.");

        return [addActivity, updateActivity, deleteActivity, addExpense, setStatus];
    }

    private static TimeOnly? ParseTime(string? value) =>
        TimeOnly.TryParse(value, CultureInfo.InvariantCulture, out var t) ? t : null;

    private static T ParseEnum<T>(string? value, T fallback) where T : struct, Enum =>
        Enum.TryParse<T>(value, ignoreCase: true, out var parsed) ? parsed : fallback;
}
