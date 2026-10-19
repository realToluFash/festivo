# Access control

Who may reach a route is part of the route's definition. It is an attribute on the
controller, read by the framework, and a route without one does not load.

## Why it is structural

The previous build asked every event-scoped route to mount its own access check. The one
that forgot behaved perfectly for everybody who was allowed in. No test caught it, no
reviewer saw it, and no user reported it, because the only people who would have noticed
were the ones who should never have had a response.

A rule enforced by discipline is already broken somewhere nobody has looked. So the rule is
not "remember to add a check". It is: **the application refuses to build its routes until
every one of them names a policy.**

## The four policies

| Attribute                       | Who gets through                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `#[PublicAccess]`               | anybody, signed in or not                                                                              |
| `#[Authenticated]`              | any signed-in account                                                                                  |
| `#[InOrganisation(permission)]` | an active member of the organisation in `{organisationId}`, holding it; with `null`, any active member |
| `#[InEvent(permission)]`        | an active member of the organisation that owns the event in `{eventId}`                                |

All four live in `App\Http\Access\Policy`. One goes on the controller class or on the
method; the method's wins, and two on the same level is refused at boot. A route that
belongs to an API Platform resource reads its policy from the resource class instead,
because API Platform's routes have no controller of ours to carry one.

A permission is a case of `App\Enum\Permission`. A policy takes the enum, not a string, so
a permission that is not in the registry cannot be asked for: it does not compile.

Each case names its **area** (a row of the roles screen's grid, `PermissionArea`) and the
**seeded roles it starts on** (`defaultRoles()`). Areas hold a `read` and a `manage`
permission, and `budget.margin` sits beside Budget's. `PermissionRegistryTest` fails for a
permission that reaches no seeded role but Owner, unless it is listed there as Owner-only
on purpose (`billing.manage`). A story that adds one names its defaults, and a migration
grants it once to those seeded roles in every existing organisation (sc-66).

What each seeded role starts with. Owner holds everything, including what is added later.
These are defaults, written when the organisation is founded, and the organisation changes
them afterwards on Settings > Roles:

| Area         | Administrator      | Event manager | Coordinator | Read-only |
| ------------ | ------------------ | ------------- | ----------- | --------- |
| Events       | manage             | manage        | manage      | read      |
| Guests       | manage             | manage        | manage      | read      |
| Seating      | manage             | manage        | manage      | read      |
| Menu         | manage             | manage        | manage      | read      |
| Run of show  | manage             | manage        | manage      | read      |
| Staff        | manage             | manage        | read        | read      |
| Messages     | manage             | manage        | manage      | read      |
| Reports      | manage             | manage        | read        | read      |
| Budget       | manage, and margin | manage        | read        | read      |
| Vendors      | manage             | none          | none        | none      |
| Members      | manage             | none          | none        | none      |
| Billing      | read               | none          | none        | none      |
| Organisation | manage             | none          | none        | none      |

**Nobody grants what they do not hold.** Creating or editing a role, a caller may add or
remove only permissions their own role holds, and a deleted role's people may move only to
a role holding nothing the caller lacks. So only an Owner can name Owner. Anything else is
`403 grant_not_held` (OWASP least privilege, NIST RBAC).

## When it is checked

- **At boot.** `PolicedRouteLoader` decorates the router's loader. Once the whole route
  collection is built, any route without a policy stops it, with an error naming the route
  and its path. The application does not start and allow everything; it does not start.
  `AccessLayerTest` also walks every registered route, so the suite fails with the route's
  name before anything is deployed.
- **On every request.** `AccessListener` runs when the controller is chosen, after the
  firewall has read the token and before any argument is resolved, and applies the route's
  policy.

`security.yaml` has no `access_control`. Two mechanisms answering one question is how the
previous build ended up with routes that one of them allowed.

The framework's own routes (API Platform's documentation, entrypoint and error pages, and
the development error preview) have nowhere to put an attribute. They are listed by name in
`FrameworkRoutes`, each public, and a framework route not on that list is refused at boot
like any other.

## The order of the checks

For `#[InEvent]`:

1. **The event is resolved first.** Its organisation comes from the event, never from the
   request.
2. **Membership of that organisation is checked.** An account that is not an active member
   gets **404**, the same as an event that does not exist. A 403 would confirm the event
   exists to somebody outside it.
3. **Then the permission.** A member without it gets **403 `permission_required`**, with
   the permission named in a `permission` member of the problem. Never an internal policy
   name, never a trace.

`#[InOrganisation]` is steps 2 and 3. **Permissions held in another organisation never
reach this far**: membership of the route's organisation is asked first, so a permission
can only widen access for somebody already inside. There is no path around step 2.

## An organisation's sign-in rules narrow what a membership grants

sc-69. `MembershipDirectory` hands every `Grants` to `SignInRules::narrow()` before the
listener sees it, so each rule applies on the next request, to sessions already open, and
only in the organisation that set it:

- **Google or Apple only**, for a member with neither linked: the grants are read-only. A
  request that is not `GET`, `HEAD` or `OPTIONS` gets **403 `oauth_only_unlinked`**. Linking
  one lifts it. A member who has one linked is refused a password at sign-in instead
  (`403 oauth_only`, naming the organisation, the account's address and the providers linked).
- **Two-factor for administrators**, for a member without it: every permission whose area is
  Members, Billing or Organisation (`Permission::isAdministrative()`) is withheld, and asking
  for one is **403 `organisation_two_factor_required`** with the permission named. Nothing
  else changes, so events keep working.

`GET /api/orgs` and `GET /api/orgs/{id}/permissions` carry `withheldUntilTwoFactor` and
`readOnlyUntilLinked`, and leave the withheld permissions out of `permissions`.

## Sub-resources are loaded through their event

A controller argument marked `#[InThisEvent('tableId')]` is loaded by
`InThisEventResolver`, which asks the resource's repository for **that id within that
event**: `findOneInEvent($eventId, $id)`. Loading the row by its bare id and checking its
event afterwards is backwards, because by then a row from another event has been read.

An id that belongs to another event answers the same 404 as an id that does not exist, so
the answer cannot be used to find another event's rows. The resolver runs ahead of
Doctrine's own entity resolver, which would load by the bare id.

A repository joins in by implementing `EventScopedRepositoryInterface` and saying which
class it loads. An `#[InThisEvent]` argument with no such repository, or on a route that is
not `#[InEvent]`, is a programming error and fails loudly.

## What answers the questions

The listener asks two interfaces:

- `MembershipDirectoryInterface::grantsIn($user, $organisationId)`: the active
  membership's `Grants`, or null when there is none. Owner holds every permission,
  including ones added later.
- `EventDirectoryInterface::organisationOf($eventId)`: the event's organisation, or null.

`App\Domain\Organisation\MembershipDirectory` answers the first from the `memberships`
table: only an `active` membership counts, and it grants what the member's role holds as
the organisation last set it (`roles.permissions`). Owner holds everything.

Until events exist, `NoEvents` answers that no event exists, so every event route refuses,
which is the direction a gap should fail in.

## The onboarding gate

Every route with an account policy (`#[Authenticated]`, `#[InOrganisation]`,
`#[InEvent]`) is also behind the onboarding gate, checked as part of "is there an
account". An account that is not **verified** gets `403 account_unverified`; one that is
verified but not **complete** gets `403 profile_incomplete`. Verification is asked first.

- **Verified** is the primary email address confirmed, and the primary phone confirmed
  if there is one. An account with no phone passes on its email alone.
- **Complete** is a non-blank name, the details screen saved once, and, for an account
  that registered on its own, membership of an organisation. `AccountCompleteness`
  answers it.

The exempt routes are one list, `OnboardingGate::EXEMPT`: `me`, email verification and
its resend and cooldown, the details screen, and setting and verifying a phone with its
resend and cooldown, since the details screen can lead there. Logout and refresh are public, so
they never reach it. A route added without being named there is gated, so an unprotected
one takes a deliberate act. `OnboardingGateTest` checks every name on the list is a real
route.
