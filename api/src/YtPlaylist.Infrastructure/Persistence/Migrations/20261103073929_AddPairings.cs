using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace YtPlaylist.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPairings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "pairing_locked_until",
                table: "sync_chains",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "sync_pairings",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    chain_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_by_device_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    code_hash = table.Column<string>(type: "character varying(43)", maxLength: 43, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    created_at = table.Column<long>(type: "bigint", nullable: false),
                    expires_at = table.Column<long>(type: "bigint", nullable: false),
                    requester_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    request_token_hash = table.Column<string>(type: "character varying(43)", maxLength: 43, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sync_pairings", x => x.id);
                    table.ForeignKey(
                        name: "FK_sync_pairings_sync_chains_chain_id",
                        column: x => x.chain_id,
                        principalTable: "sync_chains",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_sync_pairings_sync_devices_created_by_device_id",
                        column: x => x.created_by_device_id,
                        principalTable: "sync_devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                table: "sync_chains",
                keyColumn: "id",
                keyValue: "legacy",
                column: "pairing_locked_until",
                value: null);

            migrationBuilder.CreateIndex(
                name: "IX_sync_pairings_chain_id",
                table: "sync_pairings",
                column: "chain_id");

            migrationBuilder.CreateIndex(
                name: "IX_sync_pairings_code_hash",
                table: "sync_pairings",
                column: "code_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sync_pairings_created_by_device_id",
                table: "sync_pairings",
                column: "created_by_device_id");

            migrationBuilder.CreateIndex(
                name: "IX_sync_pairings_expires_at",
                table: "sync_pairings",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "IX_sync_pairings_request_token_hash",
                table: "sync_pairings",
                column: "request_token_hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sync_pairings");

            migrationBuilder.DropColumn(
                name: "pairing_locked_until",
                table: "sync_chains");
        }
    }
}
