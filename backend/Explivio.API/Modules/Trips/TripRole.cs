namespace Explivio.API.Modules.Trips;

// F15: a member's role on a trip. Ordered by privilege (Viewer < Editor < Owner) so authorization
// can compare numerically — a required minimum role is satisfied by any equal-or-higher role.
public enum TripRole
{
    Viewer = 0,
    Editor = 1,
    Owner = 2,
}
