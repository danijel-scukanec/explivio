using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Explivio.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTripSharingAndLikes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPublic",
                table: "Trips",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ShareToken",
                table: "Trips",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TripLikes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TripLikes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Trips_IsPublic",
                table: "Trips",
                column: "IsPublic");

            migrationBuilder.CreateIndex(
                name: "IX_Trips_ShareToken",
                table: "Trips",
                column: "ShareToken",
                unique: true,
                filter: "[ShareToken] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_TripLikes_TripId_UserId",
                table: "TripLikes",
                columns: new[] { "TripId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TripLikes");

            migrationBuilder.DropIndex(
                name: "IX_Trips_IsPublic",
                table: "Trips");

            migrationBuilder.DropIndex(
                name: "IX_Trips_ShareToken",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "IsPublic",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "ShareToken",
                table: "Trips");
        }
    }
}
