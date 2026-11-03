using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace YtPlaylist.Tests;

/// <summary>Keeps every log message (with its exception) in memory, to check what the API logs.</summary>
internal sealed class ListLoggerProvider : ILoggerProvider
{
    public ConcurrentQueue<string> Messages { get; } = new();

    public ILogger CreateLogger(string categoryName) => new ListLogger(this.Messages);

    public void Dispose()
    {
    }

    private sealed class ListLogger(ConcurrentQueue<string> messages) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            ArgumentNullException.ThrowIfNull(formatter);
            messages.Enqueue($"{formatter(state, exception)} {exception}");
        }
    }
}
