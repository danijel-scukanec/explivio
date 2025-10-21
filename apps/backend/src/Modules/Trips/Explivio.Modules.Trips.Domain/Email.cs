using System.Text.RegularExpressions;

namespace Explivio.Modules.Trips.Domain;

public sealed partial record Email
{
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();
    
    public string Value { get; }
    
    public Email(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Email required.");
        }

        if (!EmailRegex().IsMatch(value))
        {
            throw new ArgumentException("Invalid email format.", nameof(value));
        }
        
        Value = value.Trim();
    }
    
    public override string ToString() => Value;
}