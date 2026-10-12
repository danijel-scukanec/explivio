using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Explivio.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTripMembers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TripMembers",
                columns: table => new
                {
                    TripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Role = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AddedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TripMembers", x => new { x.TripId, x.UserId });
                });

            migrationBuilder.CreateIndex(
                name: "IX_TripMembers_UserId",
                table: "TripMembers",
                column: "UserId");

            // F15: backfill an Owner membership for every pre-existing trip from its creator, so trips
            // that existed before sharing remain accessible under the new membership-based auth.
            migrationBuilder.Sql(
                """
                INSERT INTO TripMembers (TripId, UserId, Role, AddedAt)
                SELECT t.Id, t.UserId, 'Owner', GETUTCDATE()
                FROM Trips t
                WHERE NOT EXISTS (
                    SELECT 1 FROM TripMembers m WHERE m.TripId = t.Id AND m.UserId = t.UserId);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TripMembers");
        }
    }
}
