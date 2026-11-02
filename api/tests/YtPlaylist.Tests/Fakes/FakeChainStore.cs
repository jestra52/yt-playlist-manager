using YtPlaylist.Application.Chains;
using YtPlaylist.Models.Entities;

namespace YtPlaylist.Tests;

/// <summary>In-memory sync chains, with an unclaimed legacy chain like a migrated database.</summary>
internal sealed class FakeChainStore : IChainStore
{
    private readonly Lock gate = new();

    public List<SyncChain> Chains { get; } = [new SyncChain { Id = SyncChain.LegacyId, SecretHash = null }];
    public List<SyncDevice> Devices { get; } = [];
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

    public Task CreateChainAsync(SyncChain chain, SyncDevice device, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            this.Chains.Add(chain);
            this.Devices.Add(device);
        }
        return Task.CompletedTask;
    }

    public Task AddDeviceAsync(SyncDevice device, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            this.Devices.Add(device);
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

    public Task<bool> RemoveDeviceAsync(string chainId, string deviceId, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            return Task.FromResult(this.Devices.RemoveAll(d => d.ChainId == chainId && d.Id == deviceId) > 0);
        }
    }

    public Task ReplaceSecretAsync(string chainId, string secretHash, string keepDeviceId, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            this.Chains.Single(c => c.Id == chainId).SecretHash = secretHash;
            this.Devices.RemoveAll(d => d.ChainId == chainId && d.Id != keepDeviceId);
        }
        return Task.CompletedTask;
    }

    public Task DeleteChainAsync(string chainId, CancellationToken cancellationToken)
    {
        lock (this.gate)
        {
            this.Devices.RemoveAll(d => d.ChainId == chainId);
            this.Chains.RemoveAll(c => c.Id == chainId);
            this.DeletedChains.Add(chainId);
        }
        return Task.CompletedTask;
    }

    public Task<bool> ClaimLegacyChainAsync(string secretHash, SyncDevice device, CancellationToken cancellationToken)
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
}
