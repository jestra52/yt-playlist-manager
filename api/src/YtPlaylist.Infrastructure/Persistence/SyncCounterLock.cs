using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Infrastructure.Persistence;

/// <summary>
/// The lock on the single <see cref="SyncCounter"/> row that every sync write takes. Changes
/// to who can sync (the recovery hook) take it too, so they never land in the middle of a sync.
/// </summary>
internal static class SyncCounterLock
{
    /// <summary>
    /// Locks the counter row for the rest of the current transaction and returns its value.
    /// <c>UPDATE … RETURNING</c> works on PostgreSQL and SQLite (used in tests).
    /// </summary>
    public static async Task<long> LockAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var transaction = db.Database.CurrentTransaction
            ?? throw new InvalidOperationException("The sync counter can only be locked in a transaction.");
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.Transaction = transaction.GetDbTransaction();
        command.CommandText = "UPDATE sync_counter SET value = value WHERE id = "
            + SyncCounter.SingletonId.ToString(CultureInfo.InvariantCulture)
            + " RETURNING value";
        var value = await command.ExecuteScalarAsync(cancellationToken)
            ?? throw new InvalidOperationException("The sync_counter row is missing. Run the database migrations.");
        return Convert.ToInt64(value, CultureInfo.InvariantCulture);
    }
}
