using YtPlaylist.Api;
using YtPlaylist.Api.Endpoints;
using YtPlaylist.Application;
using YtPlaylist.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment() && DotEnvFile.Find(builder.Environment.ContentRootPath) is { } envFile)
{
    builder.Configuration.AddDotEnvFile(envFile);
}

if (builder.Configuration["PORT"] is { Length: > 0 } port)
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddOptions<ApiOptions>()
    .Configure<IConfiguration>((options, config) => options.SyncToken = config["SYNC_TOKEN"] ?? "");

var allowedOrigin = builder.Configuration["ALLOWED_ORIGIN"];
builder.Services.AddCors(cors => cors.AddDefaultPolicy(policy =>
{
    if (string.IsNullOrWhiteSpace(allowedOrigin) || allowedOrigin == "*")
    {
        policy.AllowAnyOrigin();
    }
    else
    {
        policy.WithOrigins(allowedOrigin.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries));
    }
    policy.WithHeaders("Authorization", "Content-Type")
        .WithMethods("GET", "POST", "OPTIONS")
        .SetPreflightMaxAge(TimeSpan.FromDays(1));
}));

var app = builder.Build();

app.UseCors();

await app.Services.MigrateDatabaseAsync();

app.MapHealthEndpoints();
app.MapSyncEndpoints();
app.MapYouTubeEndpoints();
app.MapFallback((HttpContext http) => ApiResults.Error(StatusCodes.Status404NotFound, $"not found: {http.Request.Path}"));

await app.RunAsync();
