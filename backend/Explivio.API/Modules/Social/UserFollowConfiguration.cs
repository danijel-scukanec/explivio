using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Explivio.API.Modules.Social;

public sealed class UserFollowConfiguration : IEntityTypeConfiguration<UserFollow>
{
    public void Configure(EntityTypeBuilder<UserFollow> builder)
    {
        builder.ToTable("UserFollows");

        // F26: following is idempotent — at most one edge per (follower, followed).
        builder.HasIndex(f => new { f.FollowerUserId, f.FollowedUserId }).IsUnique();

        // "Who follows X" drives the Following feed and the follower count.
        builder.HasIndex(f => f.FollowedUserId);
    }
}
