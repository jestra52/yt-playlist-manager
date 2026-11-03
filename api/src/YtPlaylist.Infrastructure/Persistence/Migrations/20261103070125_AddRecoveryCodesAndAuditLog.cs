using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace YtPlaylist.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRecoveryCodesAndAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sync_chain_events",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    chain_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    at = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    device_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    detail = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sync_chain_events", x => x.id);
                    table.ForeignKey(
                        name: "FK_sync_chain_events_sync_chains_chain_id",
                        column: x => x.chain_id,
                        principalTable: "sync_chains",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sync_recovery_codes",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    chain_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    code_hash = table.Column<string>(type: "character varying(43)", maxLength: 43, nullable: false),
                    created_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sync_recovery_codes", x => x.id);
                    table.ForeignKey(
                        name: "FK_sync_recovery_codes_sync_chains_chain_id",
                        column: x => x.chain_id,
                        principalTable: "sync_chains",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_sync_chain_events_chain_id_at",
                table: "sync_chain_events",
                columns: new[] { "chain_id", "at" });

            migrationBuilder.CreateIndex(
                name: "IX_sync_recovery_codes_chain_id",
                table: "sync_recovery_codes",
                column: "chain_id");

            migrationBuilder.CreateIndex(
                name: "IX_sync_recovery_codes_code_hash",
                table: "sync_recovery_codes",
                column: "code_hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sync_chain_events");

            migrationBuilder.DropTable(
                name: "sync_recovery_codes");
        }
    }
}
