using YtPlaylist.Application.Chains;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Tests;

/// <summary>In-memory sync chains, with an unclaimed legacy chain like a migrated database.</summary>
internal sealed class FakeChainStore : IChainStore
{
    private readonly Lock gate = new();
    private long nextEventId;

    public List<SyncChain> Chains { get; } = [new SyncChain { Id = SyncChain.LegacyId, SecretHash = null }];
    public List<SyncDevice> Devices { get; } = [];
    public List<SyncRecoveryCode> RecoveryCodes { get; } = [];
    public List<SyncChainEvent> Events { get; } = [];
    public List<string> DeletedChains { get; } = [];

    public Task<SyncChain?> FindChainBySecretHashAsync(string secretHash, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            return Task.FromResult(this.Chains.FirstOrDefault(c => c.SecretHash == secretHash));
        }
    }

    public Task<SyncDevice?> FindDeviceByCredentialHashAsync(string credentialHash, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            return Task.FromResult(this.Devices.FirstOrDefault(d => d.CredentialHash == credentialHash));
        }
    }

    public Task<string?> FindChainIdByRecoveryCodeHashAsync(string codeHash, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            return Task.FromResult(this.RecoveryCodes.FirstOrDefault(r => r.CodeHash == codeHash)?.ChainId);
        }
    }

    public Task CreateChainAsync(
        SyncChain chain,
        SyncDevice device,
        IReadOnlyList<SyncRecoveryCode> recoveryCodes,
        SyncChainEvent auditEvent,
        CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            this.Chains.Add(chain);
            this.Devices.Add(device);
            this.RecoveryCodes.AddRange(recoveryCodes);
            this.Log(auditEvent);
        }
        return Task.CompletedTask;
    }

    public Task AddDeviceAsync(SyncDevice device, SyncChainEvent auditEvent, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            this.Devices.Add(device);
            this.Log(auditEvent);
        }
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<SyncDevice>> ListDevicesAsync(string chainId, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            return Task.FromResult<IReadOnlyList<SyncDevice>>([.. this.Devices.Where(d => d.ChainId == chainId).OrderBy(d => d.CreatedAt)]);
        }
    }

    public Task<bool> RemoveDeviceAsync(
        string chainId, string deviceId, SyncChainEvent auditEvent, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            if (this.Devices.RemoveAll(d => d.ChainId == chainId && d.Id == deviceId) == 0)
            {
                return Task.FromResult(false);
            }
            this.Log(auditEvent);
            return Task.FromResult(true);
        }
    }

    public Task<bool> ResetAccessAsync(ChainReset reset, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            if (reset.UsedRecoveryCodeHash is { } usedHash
                && this.RecoveryCodes.RemoveAll(r => r.ChainId == reset.ChainId && r.CodeHash == usedHash) == 0)
            {
                return Task.FromResult(false);
            }
            this.Chains.Single(c => c.Id == reset.ChainId).SecretHash = reset.SecretHash;
            var removed = this.Devices.Where(d => d.ChainId == reset.ChainId && d.Id != reset.KeepDeviceId).ToList();
            this.Devices.RemoveAll(removed.Contains);
            this.RecoveryCodes.RemoveAll(r => r.ChainId == reset.ChainId);
            this.RecoveryCodes.AddRange(reset.RecoveryCodes);
            if (reset.NewDevice is not null)
            {
                this.Devices.Add(reset.NewDevice);
            }
            reset.Event.Detail = ChainReset.RemovedDevicesDetail([.. removed.Select(d => d.Name)]);
            this.Log(reset.Event);
            return Task.FromResult(true);
        }
    }

    public Task ReplaceRecoveryCodesAsync(
        string chainId,
        IReadOnlyList<SyncRecoveryCode> recoveryCodes,
        SyncChainEvent auditEvent,
        CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            this.RecoveryCodes.RemoveAll(r => r.ChainId == chainId);
            this.RecoveryCodes.AddRange(recoveryCodes);
            this.Log(auditEvent);
        }
        return Task.CompletedTask;
    }

    public Task<int> CountRecoveryCodesAsync(string chainId, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            return Task.FromResult(this.RecoveryCodes.Count(r => r.ChainId == chainId));
        }
    }

    public Task<IReadOnlyList<SyncChainEvent>> ListEventsAsync(string chainId, int limit, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            return Task.FromResult<IReadOnlyList<SyncChainEvent>>(
                [.. this.Events.Where(e => e.ChainId == chainId).OrderByDescending(e => e.At).ThenByDescending(e => e.Id).Take(limit)]);
        }
    }

    public Task DeleteChainAsync(string chainId, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            this.Devices.RemoveAll(d => d.ChainId == chainId);
            this.RecoveryCodes.RemoveAll(r => r.ChainId == chainId);
            this.Events.RemoveAll(e => e.ChainId == chainId);
            this.Chains.RemoveAll(c => c.Id == chainId);
            this.DeletedChains.Add(chainId);
        }
        return Task.CompletedTask;
    }

    public Task<bool> ClaimLegacyChainAsync(
        string secretHash,
        SyncDevice device,
        IReadOnlyList<SyncRecoveryCode> recoveryCodes,
        SyncChainEvent auditEvent,
        CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            var legacy = this.Chains.FirstOrDefault(c => c.Id == SyncChain.LegacyId);
            if (legacy is null || legacy.SecretHash is not null)
            {
                return Task.FromResult(false);
            }
            legacy.SecretHash = secretHash;
            this.Devices.Add(device);
            this.RecoveryCodes.AddRange(recoveryCodes);
            this.Log(auditEvent);
            return Task.FromResult(true);
        }
    }

    public Task TouchDeviceAsync(string deviceId, long now, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            if (this.Devices.FirstOrDefault(d => d.Id == deviceId) is { } device)
            {
                device.LastSeenAt = now;
            }
        }
        return Task.CompletedTask;
    }

    private void Log(SyncChainEvent auditEvent)
    {
        auditEvent.Id = ++this.nextEventId;
        this.Events.Add(auditEvent);
    }
}
