<?php

declare(strict_types=1);

namespace App\Enum;

// A case added here without a key in all four translation files fails
// ErrorCodeCatalogueTest. The set being closed is what lets the test walk it.
enum ErrorCode: string
{
    case BadRequest = 'bad_request';
    case ValidationFailed = 'validation_failed';
    case MethodNotAllowed = 'method_not_allowed';
    case NotFound = 'not_found';
    case Conflict = 'conflict';
    case PhoneTaken = 'phone_taken';
    case OwnEventRole = 'own_event_role';
    case LastOwner = 'last_owner';
    case OwnerRequired = 'owner_required';
    case GrantNotHeld = 'grant_not_held';
    case AlreadyLinked = 'already_linked';
    case AddressLimitReached = 'address_limit_reached';
    case AddressNotVerified = 'address_not_verified';
    case PrimaryAddress = 'primary_address';
    case LastVerifiedAddress = 'last_verified_address';
    case ProviderTaken = 'provider_taken';
    case LastSignInMethod = 'last_sign_in_method';
    case ProviderKeptByRule = 'provider_kept_by_rule';
    case UnsupportedMediaType = 'unsupported_media_type';
    case PreconditionFailed = 'precondition_failed';
    case PreconditionRequired = 'precondition_required';
    case EventCurrencyInUse = 'event_currency_in_use';
    case EventStateInvalid = 'event_state_invalid';
    case EventConcluded = 'event_concluded';
    case EventPaused = 'event_paused';
    case EventHostRequired = 'event_host_required';
    case EventCallOffFirst = 'event_call_off_first';
    case PlanLimit = 'plan_limit';
    case PlanRequired = 'plan_required';
    case SeatingPlanExists = 'seating_plan_exists';
    case SeatingSectionLimit = 'seating_section_limit';
    case SeatingItemsOutside = 'seating_items_outside';
    case SeatingTableFull = 'seating_table_full';
    case SeatingTableShort = 'seating_table_short';
    case SeatingSeatTaken = 'seating_seat_taken';
    case SeatingUndoStale = 'seating_undo_stale';
    case SeatingGuestsSeated = 'seating_guests_seated';
    case SeatingGuestNotWaiting = 'seating_guest_not_waiting';
    case ScheduleItemLimit = 'schedule_item_limit';
    case ItemStarted = 'item_started';
    case ItemNotStarted = 'item_not_started';
    case ItemFinished = 'item_finished';
    case TrackBusy = 'track_busy';
    case IdempotencyKeyRequired = 'idempotency_key_required';
    case IdempotencyKeyReused = 'idempotency_key_reused';
    case GuestAlreadyListed = 'guest_already_listed';
    case StaffNumberShared = 'staff_number_shared';
    case StaffJobStaffed = 'staff_job_staffed';
    case StaffShiftFull = 'staff_shift_full';
    case StaffWorksAs = 'staff_works_as';
    case StaffShiftOverlap = 'staff_shift_overlap';
    case StaffOnShifts = 'staff_on_shifts';
    case RepliesClosed = 'replies_closed';
    case RepliesOpen = 'replies_open';
    case GuestReplied = 'guest_replied';
    case ReplyIsTheirs = 'reply_is_theirs';
    case GuestNotMarkedByHand = 'guest_not_marked_by_hand';
    case DishNameShared = 'dish_name_shared';
    case DishInUse = 'dish_in_use';
    case MenuCourseLimit = 'menu_course_limit';
    case MenuCoursePicked = 'menu_course_picked';
    case MenuDishPicked = 'menu_dish_picked';
    case MenuDishOnCourse = 'menu_dish_on_course';
    case MenuSameOneDish = 'menu_same_one_dish';
    case VariantLimit = 'variant_limit';
    case VariantPicked = 'variant_picked';
    case VariantLastEveryone = 'variant_last_everyone';
    case ChoiceLimit = 'choice_limit';
    case ChoiceAnswered = 'choice_answered';
    case ChoiceOptionPicked = 'choice_option_picked';

    case AlreadyAMember = 'already_a_member';
    case EmailTaken = 'email_taken';
    case InvitationNotFound = 'invitation_not_found';
    case InvitationExpired = 'invitation_expired';
    case InvitationRevoked = 'invitation_revoked';
    case InvitationAccepted = 'invitation_accepted';
    case InvitationDeclined = 'invitation_declined';
    case InvitationNotYours = 'invitation_not_yours';
    case JoinOfferUnavailable = 'join_offer_unavailable';
    case TeamSeatsInUse = 'team_seats_in_use';
    case RequestLinkDead = 'request_link_dead';
    case JoinRequestWaiting = 'join_request_waiting';
    case JoinRequestCoolingOff = 'join_request_cooling_off';
    case JoinRequestAnswered = 'join_request_answered';
    case OrganisationDeleted = 'organisation_deleted';
    case ExportNotReady = 'export_not_ready';
    case ExportUsed = 'export_used';
    case ExportExpired = 'export_expired';
    case RestoreNeedsAddress = 'restore_needs_address';
    case OwnerClaimAddress = 'owner_claim_address';
    case OwnerClaimManaged = 'owner_claim_managed';
    case OwnerClaimOpen = 'owner_claim_open';
    case OwnerClaimClosed = 'owner_claim_closed';
    case OwnerClaimEnded = 'owner_claim_ended';
    case OwnerClaimUnavailable = 'owner_claim_unavailable';
    case OwnerClaimOwn = 'owner_claim_own';
    case EmailDomainTaken = 'email_domain_taken';
    case DomainManaged = 'domain_managed';

    case Unauthenticated = 'unauthenticated';
    case InvalidCredentials = 'invalid_credentials';
    case InvalidRefreshToken = 'invalid_refresh_token';
    case OAuthTokenInvalid = 'oauth_token_invalid';
    case ResetLinkInvalid = 'reset_link_invalid';
    case ResetLinkUsed = 'reset_link_used';
    case ResetLinkExpired = 'reset_link_expired';
    case RegistrationExpired = 'registration_expired';
    case TwoFactorChallengeInvalid = 'two_factor_challenge_invalid';
    case Forbidden = 'forbidden';
    case PermissionRequired = 'permission_required';
    case AccountUnverified = 'account_unverified';
    case ProfileIncomplete = 'profile_incomplete';
    case TooManyAttempts = 'too_many_attempts';

    case VerificationCodeInvalid = 'verification_code_invalid';
    case VerificationCodeExpired = 'verification_code_expired';
    case VerificationCodeExhausted = 'verification_code_exhausted';

    case TwoFactorCodeInvalid = 'two_factor_code_invalid';
    case RecoveryCodeUsed = 'recovery_code_used';
    case TwoFactorAlreadyOn = 'two_factor_already_on';
    case TwoFactorNotEnrolled = 'two_factor_not_enrolled';
    case TwoFactorOff = 'two_factor_off';
    case TwoFactorRequired = 'two_factor_required';
    case ProofRequired = 'proof_required';
    case OAuthOnly = 'oauth_only';
    case OAuthOnlyUnlinked = 'oauth_only_unlinked';
    case OrganisationTwoFactorRequired = 'organisation_two_factor_required';
    case OrganisationTwoFactorOverdue = 'organisation_two_factor_overdue';
    case TwoFactorKeptByRule = 'two_factor_kept_by_rule';
    case SessionTimedOut = 'session_timed_out';
    case RecoveryNobodyToApprove = 'recovery_nobody_to_approve';
    case RecoveryRequestInvalid = 'recovery_request_invalid';
    case RecoveryRequestClosed = 'recovery_request_closed';
    case RecoveryRequestProved = 'recovery_request_proved';
    case RecoveryRequestReplaced = 'recovery_request_replaced';

    case InternalError = 'internal_error';
    case ServiceUnavailable = 'service_unavailable';

    case AssistantUnavailable = 'assistant_unavailable';
    case AssistantBusy = 'assistant_busy';
    case AssistantRefused = 'assistant_refused';

    public function status(): int
    {
        return match ($this) {
            self::BadRequest, self::IdempotencyKeyRequired => 400,
            self::ValidationFailed => 422,
            self::MethodNotAllowed => 405,
            self::NotFound, self::ResetLinkInvalid => 404,
            self::ResetLinkUsed, self::ResetLinkExpired, self::RegistrationExpired => 410,
            self::Conflict, self::PhoneTaken, self::ProviderTaken, self::LastSignInMethod, self::ProviderKeptByRule, self::TwoFactorAlreadyOn, self::TwoFactorNotEnrolled, self::TwoFactorOff, self::TwoFactorKeptByRule => 409,
            self::RecoveryNobodyToApprove, self::RecoveryRequestClosed, self::RecoveryRequestProved, self::RecoveryRequestReplaced => 409,
            self::LastOwner => 409,
            self::AlreadyLinked, self::AddressLimitReached, self::AddressNotVerified, self::PrimaryAddress, self::LastVerifiedAddress => 409,
            self::RecoveryRequestInvalid => 404,
            self::AlreadyAMember, self::EmailTaken, self::InvitationAccepted, self::InvitationDeclined, self::JoinOfferUnavailable, self::RestoreNeedsAddress, self::TeamSeatsInUse => 409,
            self::InvitationNotFound, self::RequestLinkDead => 404,
            self::JoinRequestWaiting, self::JoinRequestCoolingOff, self::JoinRequestAnswered => 409,
            self::OwnerClaimAddress, self::OwnerClaimManaged, self::OwnerClaimOpen, self::OwnerClaimClosed, self::OwnerClaimEnded, self::OwnerClaimUnavailable, self::OwnerClaimOwn, self::EmailDomainTaken, self::DomainManaged => 409,
            self::InvitationExpired, self::InvitationRevoked, self::OrganisationDeleted => 410,
            self::ExportNotReady => 409,
            self::ExportUsed, self::ExportExpired => 410,
            self::InvitationNotYours => 403,
            self::UnsupportedMediaType => 415,
            self::PreconditionFailed => 412,
            self::PreconditionRequired => 428,
            self::EventCurrencyInUse, self::EventStateInvalid, self::EventConcluded, self::EventPaused, self::EventHostRequired, self::EventCallOffFirst => 409,
            self::PlanLimit, self::PlanRequired => 403,
            self::SeatingPlanExists, self::SeatingSectionLimit, self::SeatingItemsOutside, self::SeatingTableFull, self::SeatingTableShort, self::SeatingSeatTaken, self::SeatingUndoStale, self::SeatingGuestsSeated, self::SeatingGuestNotWaiting, self::ScheduleItemLimit, self::ItemStarted, self::ItemNotStarted, self::ItemFinished, self::TrackBusy, self::GuestAlreadyListed, self::StaffNumberShared, self::StaffJobStaffed, self::StaffShiftFull, self::StaffWorksAs, self::StaffShiftOverlap, self::StaffOnShifts, self::RepliesClosed, self::RepliesOpen, self::GuestReplied, self::ReplyIsTheirs, self::GuestNotMarkedByHand, self::DishNameShared, self::DishInUse, self::MenuCourseLimit, self::MenuCoursePicked, self::MenuDishPicked, self::MenuDishOnCourse, self::MenuSameOneDish, self::VariantLimit, self::VariantPicked, self::VariantLastEveryone, self::ChoiceLimit, self::ChoiceAnswered, self::ChoiceOptionPicked => 409,
            self::Unauthenticated, self::InvalidCredentials, self::InvalidRefreshToken, self::OAuthTokenInvalid, self::TwoFactorChallengeInvalid, self::SessionTimedOut => 401,
            self::Forbidden, self::PermissionRequired, self::GrantNotHeld, self::OwnEventRole, self::AccountUnverified, self::ProfileIncomplete, self::TwoFactorRequired, self::ProofRequired => 403,
            self::OAuthOnly, self::OAuthOnlyUnlinked, self::OrganisationTwoFactorRequired, self::OrganisationTwoFactorOverdue, self::OwnerRequired => 403,
            self::TooManyAttempts => 429,
            self::VerificationCodeInvalid, self::VerificationCodeExpired => 422,
            self::VerificationCodeExhausted => 422,
            self::TwoFactorCodeInvalid, self::RecoveryCodeUsed => 422,
            self::InternalError => 500,
            self::ServiceUnavailable => 503,
            self::AssistantUnavailable, self::AssistantBusy => 503,

            self::AssistantRefused, self::IdempotencyKeyReused => 422,
        };
    }

    public const DOMAIN = 'errors';

    public function translationKey(): string
    {
        return $this->value;
    }

    public function type(): string
    {
        return 'https://soirely.com/errors/' . $this->value;
    }

    public static function fromType(string $type): ?self
    {
        $prefix = 'https://soirely.com/errors/';
        $value = \str_starts_with($type, $prefix) ? \substr($type, \strlen($prefix)) : $type;

        return self::tryFrom($value);
    }

    public static function forStatus(int $status): self
    {
        foreach (self::cases() as $case) {
            if ($case->status() === $status) {
                return $case;
            }
        }

        return $status >= 500 ? self::InternalError : self::BadRequest;
    }
}
