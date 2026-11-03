namespace YtPlaylist.Models.Chains;

/// <summary>An entry in the audit log of GET /api/chain/events; never includes a secret.</summary>
/// <param name="At">When it happened, in milliseconds since the Unix epoch.</param>
/// <param name="Kind">One of <see cref="ChainEventKind"/>.</param>
/// <param name="DeviceName">The device that did it, as it was named then; empty when no device did.</param>
/// <param name="Detail"></param>
public sealed record ChainEventInfo(long At, string Kind, string DeviceName, string Detail);
