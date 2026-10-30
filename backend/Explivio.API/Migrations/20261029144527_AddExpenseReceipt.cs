using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Explivio.API.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseReceipt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasReceipt",
                table: "Expenses",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HasReceipt",
                table: "Expenses");
        }
    }
}
