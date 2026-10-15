using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Explivio.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTripStops : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TripStops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    Place = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ArriveDate = table.Column<DateOnly>(type: "date", nullable: true),
                    DepartDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Latitude = table.Column<double>(type: "float", nullable: true),
                    Longitude = table.Column<double>(type: "float", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TripStops", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TripStops_Trips_TripId",
                        column: x => x.TripId,
                        principalTable: "Trips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TripStops_TripId_Order",
                table: "TripStops",
                columns: new[] { "TripId", "Order" });

            // F22: multi-destination migration. Every existing trip had one Destination string; make it
            // that trip's single first stop (using the trip's own dates) BEFORE dropping the column, so
            // no existing trip loses where it goes.
            migrationBuilder.Sql(
                """
                INSERT INTO [TripStops] ([Id], [TripId], [Order], [Place], [ArriveDate], [DepartDate], [Latitude], [Longitude])
                SELECT NEWID(), [Id], 0, [Destination], [StartDate], [EndDate], NULL, NULL
                FROM [Trips];
                """);

            migrationBuilder.DropColumn(
                name: "Destination",
                table: "Trips");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Destination",
                table: "Trips",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            // Restore the single Destination from the trip's first stop before dropping the stops.
            migrationBuilder.Sql(
                """
                UPDATE t
                SET t.[Destination] = COALESCE((
                    SELECT TOP 1 s.[Place] FROM [TripStops] s
                    WHERE s.[TripId] = t.[Id] ORDER BY s.[Order]), '')
                FROM [Trips] t;
                """);

            migrationBuilder.DropTable(
                name: "TripStops");
        }
    }
}
