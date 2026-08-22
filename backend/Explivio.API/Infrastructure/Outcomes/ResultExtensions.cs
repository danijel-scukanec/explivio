namespace Explivio.API.Infrastructure.Outcomes;

/// <summary>
/// The single translation point between the internal <see cref="Result"/> flow and the
/// HTTP wire format (RFC 9457 ProblemDetails). Handlers stay HTTP-agnostic; endpoints
/// call <c>ToHttpResult()</c> to turn an outcome into a response.
/// </summary>
public static class ResultExtensions
{
    public static IResult ToHttpResult<T>(this Result<T> result) =>
        result.IsSuccess
            ? Results.Ok(result.Value)
            : result.Error!.ToProblem();

    public static IResult ToHttpResult(
        this Result result,
        int successStatusCode = StatusCodes.Status204NoContent) =>
        result.IsSuccess
            ? Results.StatusCode(successStatusCode)
            : result.Error!.ToProblem();

    private static IResult ToProblem(this Error error)
    {
        var (statusCode, title) = error.Type switch
        {
            ErrorType.NotFound => (StatusCodes.Status404NotFound, "Resource not found"),
            ErrorType.Conflict => (StatusCodes.Status409Conflict, "Conflict"),
            ErrorType.Forbidden => (StatusCodes.Status403Forbidden, "Forbidden"),
            ErrorType.Unauthorized => (StatusCodes.Status401Unauthorized, "Unauthorized"),
            ErrorType.Validation => (StatusCodes.Status400BadRequest, "Validation failed"),
            _ => (StatusCodes.Status500InternalServerError, "Server error")
        };

        return Results.Problem(
            statusCode: statusCode,
            title: title,
            detail: error.Message,
            extensions: new Dictionary<string, object?> { ["code"] = error.Code });
    }
}
