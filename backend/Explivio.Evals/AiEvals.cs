using System.Text.RegularExpressions;
using Explivio.API.Modules.Itinerary;
using Explivio.API.Modules.Itinerary.GenerateItinerary;
using Explivio.API.Modules.Itinerary.ParseBooking;
using Explivio.API.Modules.Reservations;
using Explivio.API.Modules.Trips.Recap;
using Microsoft.Extensions.AI;
using Xunit;

namespace Explivio.Evals;

// F21: evals for the AI features. Unlike unit/integration tests (deterministic, against the stub),
// these run against the REAL model and score its output — a regression net for prompt/model changes.
// They need a configured model, so each skips when none is set (CI/offline), the same gating idea as
// the Testcontainers integration tests needing Docker.
public sealed class AiEvals
{
    private readonly IChatClient? _client = EvalModel.TryCreate();

    [Fact]
    public async Task Itinerary_generation_returns_a_valid_itinerary()
    {
        Assert.SkipWhen(_client is null, "AI model not configured — set AI:Endpoint / AI:ApiKey.");
        var ct = TestContext.Current.CancellationToken;

        var command = new GenerateItineraryCommand(
            Guid.NewGuid(), "A relaxed, food-focused three days in Lisbon", Days: 3, Style: null, Budget: null);
        var response = await _client!.GetResponseAsync<GeneratedItinerary>(
            ItineraryChat.BuildMessages(command), ItineraryChat.StructuredOutputOptions(), cancellationToken: ct);

        var itinerary = response.Result;
        Assert.False(string.IsNullOrWhiteSpace(itinerary.Summary));
        // At least one activity per day, with a generous upper bound (the count is model-driven).
        Assert.InRange(itinerary.Activities.Count, 3, 40);
        Assert.All(itinerary.Activities, a =>
        {
            Assert.False(string.IsNullOrWhiteSpace(a.Name));
            Assert.InRange(a.Day, 1, 3);
            Assert.True(Enum.IsDefined(a.Category));
        });
        // A food-focused prompt should surface at least one Food activity.
        Assert.Contains(itinerary.Activities, a => a.Category == ActivityCategory.Food);
    }

    [Fact]
    public async Task Booking_parse_extracts_the_flight_and_hotel()
    {
        Assert.SkipWhen(_client is null, "AI model not configured — set AI:Endpoint / AI:ApiKey.");
        var ct = TestContext.Current.CancellationToken;

        const string email =
            "SkyHigh Airways booking QX7T2P. Outbound SH220 London Heathrow (LHR) to Lisbon (LIS), " +
            "15 May 2026 08:40. Total 248.60 GBP. Hotel Alfama Vista (Booking.com), confirmation BK-559210, " +
            "check-in 15 May 2026, check-out 17 May 2026, 189.00 EUR.";
        var messages = new List<ChatMessage>
        {
            new(ChatRole.System,
                "Extract each booking from the confirmation. A booking with a provider/confirmation is a " +
                "Reservation; fill reservationType, provider, confirmationNumber, dates and cost."),
            new(ChatRole.User, email),
        };

        var response = await _client!.GetResponseAsync<ExtractedBookings>(messages, cancellationToken: ct);
        var items = response.Result.Items;

        Assert.True(items.Count >= 2, "Expected at least the flight and the hotel.");
        Assert.Contains(items, i => i.ReservationType == ReservationType.Flight && i.ConfirmationNumber == "QX7T2P");
        Assert.Contains(items, i => i.ReservationType == ReservationType.Accommodation && i.ConfirmationNumber == "BK-559210");
    }

    [Fact]
    public async Task Recap_stays_grounded_in_the_trip_facts_LLM_judge()
    {
        Assert.SkipWhen(_client is null, "AI model not configured — set AI:Endpoint / AI:ApiKey.");
        var ct = TestContext.Current.CancellationToken;

        const string facts =
            "Trip facts:\n- Name: Lisbon Long Weekend\n- Route: Lisbon\n- Dates: 2026-05-15 to 2026-05-17 (3 days)\n" +
            "- Activities by day:\n  Day 1: Tram 28, Time Out Market\n  Day 2: Belém Tower\n  Day 3: Sintra day trip";

        var recap = (await _client!.GetResponseAsync(TripRecapChat.BuildMessages(facts), cancellationToken: ct)).Text;
        Assert.False(string.IsNullOrWhiteSpace(recap));

        // LLM-as-judge: score how well the recap sticks to the given facts (invents nothing).
        var judgeMessages = new List<ChatMessage>
        {
            new(ChatRole.System,
                "You are a strict evaluator. Rate 1-5 how well the RECAP sticks to the FACTS and invents " +
                "nothing (5 = fully grounded, 1 = mostly invented). Reply with only the single digit."),
            new(ChatRole.User, $"FACTS:\n{facts}\n\nRECAP:\n{recap}"),
        };
        var verdict = (await _client!.GetResponseAsync(judgeMessages, cancellationToken: ct)).Text;
        var match = Regex.Match(verdict, @"[1-5]");
        Assert.True(match.Success, $"Judge did not return a score: '{verdict}'");
        var score = int.Parse(match.Value);
        Assert.True(score >= 4, $"Recap groundedness score too low: {score} — recap was:\n{recap}");
    }
}
