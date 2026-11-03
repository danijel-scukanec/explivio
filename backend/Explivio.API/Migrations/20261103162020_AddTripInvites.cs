using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Explivio.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTripInvites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TripInvites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    NormalizedEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Role = table.Column<int>(type: "int", nullable: false),
                    InvitedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TripInvites", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TripInvites_NormalizedEmail",
                table: "TripInvites",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "IX_TripInvites_TripId_NormalizedEmail",
                table: "TripInvites",
                columns: new[] { "TripId", "NormalizedEmail" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TripInvites");
        }
    }
}
