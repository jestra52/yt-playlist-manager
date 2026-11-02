using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace YtPlaylist.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSyncChains : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_videos_seq",
                table: "videos");

            migrationBuilder.DropIndex(
                name: "IX_playlists_seq",
                table: "playlists");

            migrationBuilder.AddColumn<string>(
                name: "chain_id",
                table: "videos",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "legacy");

            migrationBuilder.AddColumn<string>(
                name: "chain_id",
                table: "playlists",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "legacy");

            migrationBuilder.CreateTable(
                name: "sync_chains",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    secret_hash = table.Column<string>(type: "character varying(43)", maxLength: 43, nullable: true),
                    created_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sync_chains", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sync_devices",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    chain_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    credential_hash = table.Column<string>(type: "character varying(43)", maxLength: 43, nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    created_at = table.Column<long>(type: "bigint", nullable: false),
                    last_seen_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sync_devices", x => x.id);
                    table.ForeignKey(
                        name: "FK_sync_devices_sync_chains_chain_id",
                        column: x => x.chain_id,
                        principalTable: "sync_chains",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "sync_chains",
                columns: new[] { "id", "created_at", "secret_hash" },
                values: new object[] { "legacy", 0L, null });

            migrationBuilder.CreateIndex(
                name: "IX_videos_chain_id_seq",
                table: "videos",
                columns: new[] { "chain_id", "seq" });

            migrationBuilder.CreateIndex(
                name: "IX_playlists_chain_id_seq",
                table: "playlists",
                columns: new[] { "chain_id", "seq" });

            migrationBuilder.CreateIndex(
                name: "IX_sync_chains_secret_hash",
                table: "sync_chains",
                column: "secret_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sync_devices_chain_id",
                table: "sync_devices",
                column: "chain_id");

            migrationBuilder.CreateIndex(
                name: "IX_sync_devices_credential_hash",
                table: "sync_devices",
                column: "credential_hash",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_playlists_sync_chains_chain_id",
                table: "playlists",
                column: "chain_id",
                principalTable: "sync_chains",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_videos_sync_chains_chain_id",
                table: "videos",
                column: "chain_id",
                principalTable: "sync_chains",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_playlists_sync_chains_chain_id",
                table: "playlists");

            migrationBuilder.DropForeignKey(
                name: "FK_videos_sync_chains_chain_id",
                table: "videos");

            migrationBuilder.DropTable(
                name: "sync_devices");

            migrationBuilder.DropTable(
                name: "sync_chains");

            migrationBuilder.DropIndex(
                name: "IX_videos_chain_id_seq",
                table: "videos");

            migrationBuilder.DropIndex(
                name: "IX_playlists_chain_id_seq",
                table: "playlists");

            migrationBuilder.DropColumn(
                name: "chain_id",
                table: "videos");

            migrationBuilder.DropColumn(
                name: "chain_id",
                table: "playlists");

            migrationBuilder.CreateIndex(
                name: "IX_videos_seq",
                table: "videos",
                column: "seq");

            migrationBuilder.CreateIndex(
                name: "IX_playlists_seq",
                table: "playlists",
                column: "seq");
        }
    }
}
