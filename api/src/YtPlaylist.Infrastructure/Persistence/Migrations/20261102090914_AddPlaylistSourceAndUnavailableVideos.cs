using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace YtPlaylist.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPlaylistSourceAndUnavailableVideos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "unavailable",
                table: "videos",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "source",
                table: "playlists",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "source_id",
                table: "playlists",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "unavailable",
                table: "videos");

            migrationBuilder.DropColumn(
                name: "source",
                table: "playlists");

            migrationBuilder.DropColumn(
                name: "source_id",
                table: "playlists");
        }
    }
}
