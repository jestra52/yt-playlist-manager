using Microsoft.Extensions.DependencyInjection;
using YtPlaylist.Application.Sync;

namespace YtPlaylist.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<SyncService>();
        return services;
    }
}
