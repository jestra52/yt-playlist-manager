using YtPlaylist.Models.Entities;

namespace YtPlaylist.Application.Chains;

/// <summary>
/// What the recovery hook changes in one transaction: the chain's new secret, its new
/// recovery codes, the devices that stay (one kept, or one new) and the audit entry.
/// </summary>
/// <param name="ChainId"></param>
/// <param name="SecretHash">The hash of the chain code's new secret.</param>
/// <param name="RecoveryCodes">The new recovery codes, replacing every old one.</param>
/// <param name="Event">The audit entry; the store adds the names of the removed devices to its detail.</param>
public sealed record ChainReset(
    string ChainId, string SecretHash, IReadOnlyList<SyncRecoveryCode> RecoveryCodes, SyncChainEvent Event)
{
    /// <summary>The device that stays in the chain (the caller); every other one is removed.</summary>
    public string? KeepDeviceId { get; init; }

    /// <summary>A device that joins as every old one is removed (the device that recovered).</summary>
    public SyncDevice? NewDevice { get; init; }

    /// <summary>
    /// The hash of the recovery code used. The reset only happens when that code is still
    /// unused, so two recoveries with the same code can't both succeed.
    /// </summary>
    public string? UsedRecoveryCodeHash { get; init; }

    /// <summary>The audit detail for the devices a reset removed.</summary>
    public static string RemovedDevicesDetail(IReadOnlyCollection<string> names)
    {
        ArgumentNullException.ThrowIfNull(names);
        return names.Count == 0 ? "" : $"removed {string.Join(", ", names)}";
    }
}
