using Microsoft.Extensions.DependencyInjection;
using YtPlaylist.Application.Chains;
using YtPlaylist.Application.Sync;

namespace YtPlaylist.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<SyncService>();
        services.AddScoped<ChainService>();
        return services;
    }
}
