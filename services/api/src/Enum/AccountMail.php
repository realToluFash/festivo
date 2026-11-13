<?php

declare(strict_types=1);

namespace App\Enum;

/** Every account and security email, each a registered type on the one notification path (sc-4332). */
enum AccountMail: string
{
    case VerificationCode = 'verification_code';
    case SignUpCode = 'sign_up_code';
    case AlreadyRegistered = 'already_registered';
    case PasswordCode = 'password_code';
    case PasswordChanged = 'password_changed';
    case PasswordAdded = 'password_added';
    case RecoveryLink = 'recovery_link';
    case RecoveryHowYouSignIn = 'recovery_how_you_sign_in';
    case RecoveryChanged = 'recovery_changed';
    case NewDevice = 'new_device';
    case SignInMethod = 'sign_in_method';
    case TwoFactor = 'two_factor';
    case TwoFactorRecoveryCode = 'two_factor_recovery_code';
    case TwoFactorRecovery = 'two_factor_recovery';
    case Invitation = 'invitation';
    case Ownership = 'ownership';
    case SignInRules = 'sign_in_rules';
    case OrganisationDeleted = 'organisation_deleted';
    case JoinRequest = 'join_request';
    case MemberAccess = 'member_access';
    case DomainSuspended = 'domain_suspended';
    case OwnerClaim = 'owner_claim';

    public function typeName(): string
    {
        return 'mail.' . $this->value;
    }

    /** Stops at the code's expiry, and gives way to a newer code for the same address. */
    public function carriesCode(): bool
    {
        return match ($this) {
            self::VerificationCode, self::SignUpCode, self::PasswordCode, self::RecoveryLink, self::TwoFactorRecoveryCode => true,
            default => false,
        };
    }

    /** Sent to a suppressed address all the same: the person may be trying to get back in. */
    public function isSecurity(): bool
    {
        return match ($this) {
            self::VerificationCode,
            self::SignUpCode,
            self::PasswordCode,
            self::RecoveryLink,
            self::RecoveryHowYouSignIn,
            self::RecoveryChanged,
            self::NewDevice,
            self::TwoFactor,
            self::TwoFactorRecoveryCode,
            self::TwoFactorRecovery => true,
            default => false,
        };
    }
}
