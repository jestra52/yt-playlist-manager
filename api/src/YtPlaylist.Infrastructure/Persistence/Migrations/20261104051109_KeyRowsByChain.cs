using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace YtPlaylist.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class KeyRowsByChain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_videos",
                table: "videos");

            migrationBuilder.DropIndex(
                name: "IX_videos_playlist_id",
                table: "videos");

            migrationBuilder.DropPrimaryKey(
                name: "PK_playlists",
                table: "playlists");

            migrationBuilder.AddPrimaryKey(
                name: "PK_videos",
                table: "videos",
                columns: new[] { "chain_id", "id" });

            migrationBuilder.AddPrimaryKey(
                name: "PK_playlists",
                table: "playlists",
                columns: new[] { "chain_id", "id" });

            migrationBuilder.CreateIndex(
                name: "IX_videos_chain_id_playlist_id",
                table: "videos",
                columns: new[] { "chain_id", "playlist_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_videos",
                table: "videos");

            migrationBuilder.DropIndex(
                name: "IX_videos_chain_id_playlist_id",
                table: "videos");

            migrationBuilder.DropPrimaryKey(
                name: "PK_playlists",
                table: "playlists");

            migrationBuilder.AddPrimaryKey(
                name: "PK_videos",
                table: "videos",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_playlists",
                table: "playlists",
                column: "id");

            migrationBuilder.CreateIndex(
                name: "IX_videos_playlist_id",
                table: "videos",
                column: "playlist_id");
        }
    }
}
