using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using YtPlaylist.Api;
using YtPlaylist.Api.Endpoints;
using YtPlaylist.Application;
using YtPlaylist.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddLocalSettingsFile(builder.Environment.ContentRootPath);
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
        .WithMethods("GET", "POST", "DELETE", "OPTIONS")
        .SetPreflightMaxAge(TimeSpan.FromDays(1));
}));

// The API runs behind Netlify's and Render's proxies, so the client's address is in
// X-Forwarded-For. Rate limits use it, plus a cap for everyone together, because the
// header can be forged by a client that calls the API directly.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddRateLimiter(limiter =>
{
    limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    limiter.OnRejected = (context, cancellationToken) => new ValueTask(
        ApiResults.Error(StatusCodes.Status429TooManyRequests, "too many attempts; wait a minute and try again")
            .ExecuteAsync(context.HttpContext));
    limiter.AddPolicy(ChainEndpoints.SecretsRateLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    // Recovering is rare, so a few attempts per IP in a quarter of an hour are enough; this is
    // also the lockout after repeated failures (the codes can't be guessed anyway).
    limiter.AddPolicy(ChainEndpoints.RecoveryRateLimit, http => RateLimitPartition.GetSlidingWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(15),
            SegmentsPerWindow = 3,
            QueueLimit = 0,
        }));

    // Entering a pairing code: a few tries per IP. Wrong codes also lock the IP out
    // (IAttemptLockout), and a used code entered again counts against its chain.
    limiter.AddPolicy(ChainEndpoints.PairingRateLimit, http => RateLimitPartition.GetSlidingWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(15),
            SegmentsPerWindow = 3,
            QueueLimit = 0,
        }));

    // A new device asks every few seconds whether it was approved, for a few minutes at most.
    limiter.AddPolicy(ChainEndpoints.PairingStatusRateLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    limiter.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http =>
        http.Request.Path.StartsWithSegments("/api/chains", StringComparison.OrdinalIgnoreCase)
            ? RateLimitPartition.GetFixedWindowLimiter(
                "chain-secrets-everyone",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })
            : RateLimitPartition.GetNoLimiter("other"));
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseCors();
app.UseRateLimiter();

await app.Services.MigrateDatabaseAsync();

app.MapHealthEndpoints();
app.MapChainEndpoints();
app.MapSyncEndpoints();
app.MapYouTubeEndpoints();
app.MapFallback((HttpContext http) => ApiResults.Error(StatusCodes.Status404NotFound, $"not found: {http.Request.Path}"));

await app.RunAsync();
