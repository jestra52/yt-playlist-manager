namespace YtPlaylist.Domain.Common;

/// <summary>Input that breaks a business rule. The API answers it with 400 Bad Request.</summary>
public sealed class DomainValidationException(string message) : Exception(message);
