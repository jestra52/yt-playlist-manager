namespace YtPlaylist.Models.Entities;

/// <summary>
/// An entry in a chain's audit log: what happened and from which device. Never
/// holds a secret; device names are copied in because the device may be removed later.
/// </summary>
public sealed class SyncChainEvent
{
    public long Id { get; set; }
    public required string ChainId { get; set; }

    /// <summary>Milliseconds since the Unix epoch.</summary>
    public long At { get; set; }

    /// <summary>One of <see cref="Chains.ChainEventKind"/>.</summary>
    public required string Kind { get; set; }

    /// <summary>The device that did it, as it was named then; empty when no device did.</summary>
    public string DeviceName { get; set; } = "";

    /// <summary>Plain text about it, e.g. the removed device's name; never a secret.</summary>
    public string Detail { get; set; } = "";
}
