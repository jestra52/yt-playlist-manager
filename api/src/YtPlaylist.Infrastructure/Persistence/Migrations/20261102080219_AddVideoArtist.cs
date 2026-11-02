using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace YtPlaylist.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVideoArtist : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "artist",
                table: "videos",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "artist_source",
                table: "videos",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "artist",
                table: "videos");

            migrationBuilder.DropColumn(
                name: "artist_source",
                table: "videos");
        }
    }
}
