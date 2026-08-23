using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Explivio.API.Infrastructure.Api;

// F09: the URL-segment version reader leaves the route template as "/v{version}" in the
// generated OpenAPI document. This transformer substitutes the concrete version (e.g. "/v1")
// and drops the now-redundant "version" path parameter, so consumers — including the
// frontend's openapi-typescript generation — see the real paths they actually call.
public sealed class ReplaceVersionParameterTransformer : IOpenApiDocumentTransformer
{
    public Task TransformAsync(
        OpenApiDocument document,
        OpenApiDocumentTransformerContext context,
        CancellationToken cancellationToken)
    {
        // The OpenAPI document name mirrors the API version group ("v1" -> "1").
        var version = new string(context.DocumentName.Where(char.IsDigit).ToArray());
        if (string.IsNullOrEmpty(version))
        {
            version = "1";
        }

        var rewritten = new OpenApiPaths();
        foreach (var (path, item) in document.Paths)
        {
            var newPath = path.Replace("{version}", version, StringComparison.Ordinal);

            foreach (var operation in item.Operations?.Values ?? Enumerable.Empty<OpenApiOperation>())
            {
                var versionParam = operation.Parameters?
                    .FirstOrDefault(p => p.Name == "version");
                if (versionParam is not null)
                {
                    operation.Parameters!.Remove(versionParam);
                }
            }

            rewritten.Add(newPath, item);
        }

        document.Paths = rewritten;
        return Task.CompletedTask;
    }
}
