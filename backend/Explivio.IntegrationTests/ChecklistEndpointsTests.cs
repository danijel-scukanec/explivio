using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Explivio.IntegrationTests;

// F24: end-to-end coverage of the checklist slice (named lists + items) through the real HTTP
// pipeline and SQL.
public sealed class ChecklistEndpointsTests(ExplivioApiFactory factory) : IClassFixture<ExplivioApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Create_list_add_items_toggle_and_read_back()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        // Create a named list.
        var createList = await _client.PostAsJsonAsync(
            $"/v1/trips/{tripId}/checklists", new { name = "Packing" }, ct);
        Assert.Equal(HttpStatusCode.Created, createList.StatusCode);
        var list = await createList.Content.ReadFromJsonAsync<CreatedResponse>(ct);

        // Add two items.
        var addA = await _client.PostAsJsonAsync(
            $"/v1/trips/{tripId}/checklists/{list!.Id}/items", new { text = "Passport" }, ct);
        Assert.Equal(HttpStatusCode.Created, addA.StatusCode);
        var itemA = await addA.Content.ReadFromJsonAsync<CreatedResponse>(ct);

        var addB = await _client.PostAsJsonAsync(
            $"/v1/trips/{tripId}/checklists/{list.Id}/items", new { text = "Charger" }, ct);
        Assert.Equal(HttpStatusCode.Created, addB.StatusCode);

        // Toggle the first item checked.
        var toggle = await _client.PutAsJsonAsync(
            $"/v1/trips/{tripId}/checklists/{list.Id}/items/{itemA!.Id}",
            new { text = "Passport", isChecked = true }, ct);
        Assert.Equal(HttpStatusCode.NoContent, toggle.StatusCode);

        // Read back: one list, two items in insertion order, first checked.
        var lists = await _client.GetFromJsonAsync<List<ChecklistDto>>($"/v1/trips/{tripId}/checklists", ct);
        Assert.NotNull(lists);
        Assert.Single(lists);
        Assert.Equal("Packing", lists[0].Name);
        Assert.Equal(2, lists[0].Items.Count);
        Assert.Equal("Passport", lists[0].Items[0].Text);
        Assert.True(lists[0].Items[0].IsChecked);
        Assert.Equal("Charger", lists[0].Items[1].Text);
        Assert.False(lists[0].Items[1].IsChecked);
    }

    [Fact]
    public async Task Delete_list_removes_it_and_its_items()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        var createList = await _client.PostAsJsonAsync(
            $"/v1/trips/{tripId}/checklists", new { name = "To-do" }, ct);
        var list = await createList.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        await _client.PostAsJsonAsync(
            $"/v1/trips/{tripId}/checklists/{list!.Id}/items", new { text = "Check in online" }, ct);

        var delete = await _client.DeleteAsync($"/v1/trips/{tripId}/checklists/{list.Id}", ct);
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var lists = await _client.GetFromJsonAsync<List<ChecklistDto>>($"/v1/trips/{tripId}/checklists", ct);
        Assert.Empty(lists!);
    }

    [Fact]
    public async Task Add_item_to_missing_list_returns_404()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        var add = await _client.PostAsJsonAsync(
            $"/v1/trips/{tripId}/checklists/{Guid.NewGuid()}/items", new { text = "Nope" }, ct);
        Assert.Equal(HttpStatusCode.NotFound, add.StatusCode);
    }

    [Fact]
    public async Task Create_list_with_blank_name_returns_400()
    {
        var ct = TestContext.Current.CancellationToken;
        var tripId = await CreateTripAsync(ct);

        var create = await _client.PostAsJsonAsync(
            $"/v1/trips/{tripId}/checklists", new { name = "" }, ct);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
    }

    private async Task<Guid> CreateTripAsync(CancellationToken ct)
    {
        var create = await _client.PostAsJsonAsync("/v1/trips", new
        {
            name = "Checklist Trip",
            startDate = "2026-11-01",
            endDate = "2026-11-03",
            travelerCount = 1,
            stops = new[] { new { place = "Porto" } },
            userId = ExplivioApiFactory.DevUserId,
        }, ct);
        var created = await create.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        return created!.Id;
    }

    private sealed record CreatedResponse(Guid Id);
    private sealed record ChecklistDto(Guid Id, string Name, List<ChecklistItemDto> Items);
    private sealed record ChecklistItemDto(Guid Id, string Text, bool IsChecked);
}
