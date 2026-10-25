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
    case OwnerRoleFixed = 'owner_role_fixed';
    case SeededRoleKept = 'seeded_role_kept';
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
    case RestoreNeedsAddress = 'restore_needs_address';
    case OwnerClaimAddress = 'owner_claim_address';
    case OwnerClaimManaged = 'owner_claim_managed';
    case OwnerClaimOpen = 'owner_claim_open';
    case OwnerClaimClosed = 'owner_claim_closed';
    case OwnerClaimEnded = 'owner_claim_ended';
    case OwnerClaimUnavailable = 'owner_claim_unavailable';
    case OwnerClaimOwn = 'owner_claim_own';

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
    case TooManyRequests = 'too_many_requests';
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
            self::BadRequest => 400,
            self::ValidationFailed => 422,
            self::MethodNotAllowed => 405,
            self::NotFound, self::ResetLinkInvalid => 404,
            self::ResetLinkUsed, self::ResetLinkExpired, self::RegistrationExpired => 410,
            self::Conflict, self::PhoneTaken, self::ProviderTaken, self::LastSignInMethod, self::ProviderKeptByRule, self::TwoFactorAlreadyOn, self::TwoFactorNotEnrolled, self::TwoFactorOff, self::TwoFactorKeptByRule => 409,
            self::RecoveryNobodyToApprove, self::RecoveryRequestClosed, self::RecoveryRequestProved, self::RecoveryRequestReplaced => 409,
            self::OwnerRoleFixed, self::SeededRoleKept, self::LastOwner => 409,
            self::AlreadyLinked, self::AddressLimitReached, self::AddressNotVerified, self::PrimaryAddress, self::LastVerifiedAddress => 409,
            self::RecoveryRequestInvalid => 404,
            self::AlreadyAMember, self::EmailTaken, self::InvitationAccepted, self::InvitationDeclined, self::JoinOfferUnavailable, self::RestoreNeedsAddress, self::TeamSeatsInUse => 409,
            self::InvitationNotFound, self::RequestLinkDead => 404,
            self::JoinRequestWaiting, self::JoinRequestCoolingOff, self::JoinRequestAnswered => 409,
            self::OwnerClaimAddress, self::OwnerClaimManaged, self::OwnerClaimOpen, self::OwnerClaimClosed, self::OwnerClaimEnded, self::OwnerClaimUnavailable, self::OwnerClaimOwn => 409,
            self::InvitationExpired, self::InvitationRevoked, self::OrganisationDeleted => 410,
            self::InvitationNotYours => 403,
            self::UnsupportedMediaType => 415,
            self::PreconditionFailed => 412,
            self::PreconditionRequired => 428,
            self::EventCurrencyInUse => 409,
            self::Unauthenticated, self::InvalidCredentials, self::InvalidRefreshToken, self::OAuthTokenInvalid, self::TwoFactorChallengeInvalid, self::SessionTimedOut => 401,
            self::Forbidden, self::PermissionRequired, self::GrantNotHeld, self::AccountUnverified, self::ProfileIncomplete, self::TwoFactorRequired, self::ProofRequired => 403,
            self::OAuthOnly, self::OAuthOnlyUnlinked, self::OrganisationTwoFactorRequired, self::OrganisationTwoFactorOverdue, self::OwnerRequired => 403,
            self::TooManyRequests, self::TooManyAttempts => 429,
            self::VerificationCodeInvalid, self::VerificationCodeExpired => 422,
            self::VerificationCodeExhausted => 422,
            self::TwoFactorCodeInvalid, self::RecoveryCodeUsed => 422,
            self::InternalError => 500,
            self::ServiceUnavailable => 503,
            self::AssistantUnavailable, self::AssistantBusy => 503,

            self::AssistantRefused => 422,
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
