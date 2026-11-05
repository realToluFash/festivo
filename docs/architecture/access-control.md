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

| Attribute                       | Who gets through                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `#[PublicAccess]`               | anybody, signed in or not                                                                               |
| `#[Authenticated]`              | any signed-in account                                                                                   |
| `#[InOrganisation(permission)]` | an active member of the organisation in `{organisationId}`, holding it; with `null`, any active member  |
| `#[InEvent(permission)]`        | an Owner or Admin of the organisation that owns the event in `{eventId}`, or a Member with a role on it |

All four live in `App\Http\Access\Policy`. One goes on the controller class or on the
method; the method's wins, and two on the same level is refused at boot. A route that
belongs to an API Platform resource reads its policy from the resource class instead,
because API Platform's routes have no controller of ours to carry one.

A permission is a case of `App\Enum\Permission`. A policy takes the enum, not a string, so
a permission that is not in the registry cannot be asked for: it does not compile.

Each case names its **area** (a row of the roles screen's grid, `PermissionArea`) and the
**roles that hold it** (`defaultRoles()`). Areas hold a `read` and a `manage` permission,
`budget.margin` sits beside Budget's and `events.create` beside Events'.

### Three organisation roles (sc-29912)

Every organisation has exactly three roles, `SeededRole`, and nothing creates, renames,
edits or removes one: the roles screen only lists them.

| Role   | Holds across the organisation                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Owner  | everything, including what is added later                                                                                        |
| Admin  | everything but `billing.manage`; it never transfers ownership or deletes the organisation, which ask for an Owner (`OwnerCheck`) |
| Member | nothing                                                                                                                          |

What a role holds is fixed in code (`Role::getPermissions()` reads `defaultRoles()`), not
stored, so a permission added later reaches Owner and Admin with no migration.
`PermissionRegistryTest` fails for a permission that reaches neither, unless it is listed
there as Owner-only on purpose (`billing.manage`). Admin's stored value stays
`administrator`, which the clients already read.

### Roles on an event

A Member reaches an event only through a role on it, an `EventPerson` row
(`event_people`): their membership, the event, an `EventRole` and an optional job label.
Owners and Admins reach every event and need no row.

| Area        | Lead   | Can edit | Can view | Can check guests in |
| ----------- | ------ | -------- | -------- | ------------------- |
| Events      | manage | manage   | read     | read                |
| Guests      | manage | manage   | read     | read                |
| Seating     | manage | manage   | read     | none                |
| Menu        | manage | manage   | read     | none                |
| Run of show | manage | manage   | read     | none                |
| Staff       | manage | manage   | read     | none                |
| Messages    | manage | manage   | read     | none                |
| Reports     | manage | manage   | read     | none                |
| Budget      | manage | none     | none     | none                |
| People      | manage | read     | read     | read                |

No event role holds `events.create`, Vendors, Members, Billing or Organisation, so only an
Owner or an Admin starts, duplicates or deletes an event. `EventRole::permissions()` is the
table above, and `EventRoleTest` holds it to it.

People (`/api/events/{eventId}/people`) is read by everyone on the event. An Owner, an Admin
or the event's Lead adds, changes and removes people (`people.manage`); nobody changes or
removes their own role (`403 own_event_role`). People adds members of the organisation only:
Lead for somebody from outside it waits on sc-71. A change applies on the person's next
request, since nothing about it is in their token.

Removing somebody from the organisation deletes their event roles
(`MembershipMachine::move`). Suspending them keeps the roles, so a restore gives them back.

**Nobody grants what they do not hold.** Inviting, approving a request and changing a role
accept Admin and Member, and a caller may put somebody only in a role holding nothing the
caller lacks. So only an Owner can make an Owner. Anything else is `403 grant_not_held`
(OWASP least privilege, NIST RBAC). Putting a person in a role, by any path, goes through
`RoleManager::mayGrant()`, its one owner.

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

The framework's own routes (API Platform's documentation and error pages, and
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
3. **A Member's role on the event is found.** A Member with no role on it gets the same
   **404**. An Owner's or an Admin's grants are the organisation's.
4. **Then the permission**, from the role on the event for a Member. A member without it gets **403 `permission_required`**, with
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
  A password session ends the same way at its next refresh, except the one a provider was
  linked from: linking is a sign-in with that provider, so the chain is marked signed in with
  it (`TokenIssuer::markSignedInWith`) and carries on, and unlinking that provider ends it.
  The marking happens under this rule only: without it, unlinking ends only the sessions
  started through the provider (sc-510), never the password session it was linked from.
  Nobody can require it without having it either (sc-3290): turning it on while the person
  saving has neither linked is the same **403 `oauth_only_unlinked`**, and nothing in that
  save is changed. The page carries `ownProvider`, and its `passwordOnly` list never names
  the caller.
- **Two-factor for administrators**, for a member without it: every permission whose area is
  Members, Billing or Organisation (`Permission::isAdministrative()`) is withheld, and asking
  for one is **403 `organisation_two_factor_required`** with the permission named. Nothing
  else changes, so events keep working. Nobody can require it without having it: turning it
  on while the person saving has no two-factor of their own is **409 `two_factor_off`**,
  and nothing in that save is changed. The sign-in rules page
  (`GET /api/orgs/{id}/sign-in-rules`) carries `ownTwoFactor`, so it refuses before sending.
- **Two-factor for everyone** (sc-609), for a member without it: nothing changes for 7 × 24
  hours from the switch-on instant (`organisations.two_factor_required_since`), or from
  joining, whichever is later. After that every request in the organisation is **403
  `organisation_two_factor_overdue`**, however the session was opened, until two-factor is
  on; the organisation stays in `GET /api/orgs` so the client can say why. Turning two-factor
  off while any organisation requires it is **409 `two_factor_kept_by_rule`**, naming it.
  Switching it on has the same `two_factor_off` refusal as the administrators' rule, and
  emails every member without two-factor the deadline. The hold needs no job, but
  `app:sign-in-rules:record-two-factor-holds` audits each member it holds, once
  (`memberships.two_factor_blocked_at`).

`GET /api/orgs` and `GET /api/orgs/{id}/permissions` carry `withheldUntilTwoFactor`,
`readOnlyUntilLinked` and `withheldUntilLinked` (the changes the role holds that the
read-only rule keeps back), and leave the withheld permissions out of `permissions`, so a
client can tell a rule from the role as the reason (sc-16265). `GET
/api/orgs` also carries `twoFactorDue` (`at`, `written` in the member's own zone by sc-868,
`overdue`) while the member has a deadline to meet.

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
- `MembershipDirectoryInterface::grantsOnEvent($user, $organisationId, $eventId)`: the
  grants on one event, from the role on it for a Member, or null when they have none.
- `MembershipDirectoryInterface::eventScopeIn($user, $organisationId)`: an `EventScope`
  for a list, saying whether it is narrowed to one Member's events (`onlyFor`) and the
  grants on each. Every list of events, the calendar feed and an event's notification
  audience read it, so a Member sees only the events they have a role on.
- `EventDirectoryInterface::organisationOf($eventId)`: the event's organisation, or null.

`App\Domain\Organisation\MembershipDirectory` answers the first from the `memberships`
table: only an `active` membership counts, and it grants what the member's role holds, and
for a Member on an event, what their `event_people` row's role holds.

`App\Domain\Event\EventDirectory` answers the second from the `events` table, so an
unknown event and another organisation's are the same 404.

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
