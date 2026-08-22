namespace Explivio.API.Infrastructure.Outcomes;

/// <summary>
/// The semantic kind of a failure. Deliberately HTTP-agnostic — the mapping to a
/// status code happens at the HTTP boundary (see <see cref="ResultExtensions"/>),
/// so the same <see cref="Error"/> can be handled by a non-HTTP caller (e.g. a worker).
/// </summary>
public enum ErrorType
{
    Validation,
    NotFound,
    Conflict,
    Forbidden,
    Unauthorized
}

/// <summary>
/// Describes an expected failure. <paramref name="Code"/> is a stable machine-readable
/// identifier (e.g. "Trip.NotFound"); <paramref name="Message"/> is human-readable detail.
/// </summary>
public sealed record Error(ErrorType Type, string Code, string Message)
{
    public static Error NotFound(string code, string message) => new(ErrorType.NotFound, code, message);
    public static Error Conflict(string code, string message) => new(ErrorType.Conflict, code, message);
    public static Error Forbidden(string code, string message) => new(ErrorType.Forbidden, code, message);
    public static Error Unauthorized(string code, string message) => new(ErrorType.Unauthorized, code, message);
    public static Error Validation(string code, string message) => new(ErrorType.Validation, code, message);
}
