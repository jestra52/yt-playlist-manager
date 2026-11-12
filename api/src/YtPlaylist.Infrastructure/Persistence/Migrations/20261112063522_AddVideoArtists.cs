using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace YtPlaylist.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVideoArtists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "artists",
                table: "videos",
                type: "text",
                nullable: false,
                defaultValue: "[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "artists",
                table: "videos");
        }
    }
}
