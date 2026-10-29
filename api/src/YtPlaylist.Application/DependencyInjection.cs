using Microsoft.Extensions.DependencyInjection;
using YtPlaylist.Application.Sync;

namespace YtPlaylist.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // SyncService takes ISyncStore as optional: without a database it reports itself unavailable.
        services.AddScoped<SyncService>();
        return services;
    }
}
