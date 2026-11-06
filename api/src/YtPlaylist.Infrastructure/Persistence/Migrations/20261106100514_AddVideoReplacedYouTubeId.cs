using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace YtPlaylist.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVideoReplacedYouTubeId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "replaced_youtube_id",
                table: "videos",
                type: "character varying(11)",
                maxLength: 11,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "replaced_youtube_id",
                table: "videos");
        }
    }
}
