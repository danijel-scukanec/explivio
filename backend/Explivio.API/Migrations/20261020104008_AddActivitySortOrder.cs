using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Explivio.API.Migrations
{
    /// <inheritdoc />
    public partial class AddActivitySortOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Activities",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // F23: seed each existing activity's SortOrder from its current position within its day,
            // preserving the old "by start time" order (nulls last) so existing itineraries look
            // unchanged. CreatedAt breaks ties deterministically.
            migrationBuilder.Sql("""
                WITH ordered AS (
                    SELECT Id,
                           ROW_NUMBER() OVER (
                               PARTITION BY TripId, Date
                               ORDER BY CASE WHEN StartTime IS NULL THEN 1 ELSE 0 END, StartTime, CreatedAt
                           ) - 1 AS rn
                    FROM Activities
                )
                UPDATE a
                SET a.SortOrder = o.rn
                FROM Activities a
                INNER JOIN ordered o ON o.Id = a.Id;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Activities");
        }
    }
}
