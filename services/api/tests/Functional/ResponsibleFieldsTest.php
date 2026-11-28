<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Handover\ResponsibleFields;
use App\Entity\AuditExport;
use App\Entity\CalendarFeed;
use App\Entity\DoorCode;
use App\Entity\DoorCodeRedemption;
use App\Entity\EmailAddress;
use App\Entity\EventChange;
use App\Entity\EventMute;
use App\Entity\EventPerson;
use App\Entity\Guest;
use App\Entity\GuestMessage;
use App\Entity\GuestReplyLook;
use App\Entity\Invitation;
use App\Entity\JoinOfferDismissal;
use App\Entity\KitchenCopy;
use App\Entity\KnownDevice;
use App\Entity\MealAnswer;
use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\NotificationItem;
use App\Entity\NotificationPreference;
use App\Entity\OrganisationExport;
use App\Entity\OwnerClaim;
use App\Entity\Passkey;
use App\Entity\PasskeyChallenge;
use App\Entity\PasswordResetToken;
use App\Entity\PasswordSetCode;
use App\Entity\PhoneNumber;
use App\Entity\ProviderIdentity;
use App\Entity\PushTarget;
use App\Entity\RecoveryCode;
use App\Entity\RefreshToken;
use App\Entity\ScheduledPayment;
use App\Entity\ScheduleItem;
use App\Entity\SchedulePress;
use App\Entity\SeatingPlan;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Entity\ServiceFiring;
use App\Entity\ServiceItem;
use App\Entity\ServiceStep;
use App\Entity\ServiceTap;
use App\Entity\ServiceTray;
use App\Entity\SignInProof;
use App\Entity\StaffMember;
use App\Entity\StaffRate;
use App\Entity\TwoFactorChallenge;
use App\Entity\TwoFactorFactor;
use App\Entity\TwoFactorRecovery;
use App\Entity\User;
use App\Tests\FunctionalTestCase;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Vec;

/** sc-614: a field that names somebody as responsible for something is handed over when they go, so none may be missed. */
final class ResponsibleFieldsTest extends FunctionalTestCase
{
    private const string ACCOUNT = "the account's own, which goes nowhere when they leave an organisation";

    private const string HISTORY = 'history: who did something, kept as it was';

    private const string MEMBERSHIP = 'the membership itself, which is what ends';

    private const string OUTSIDE = 'someone from outside, who is never a Lead and never a member to leave';

    private const string WHO_JOINED = 'who joined through a door code: a way in, not something to look after';

    private const string ROSTER = 'a place on a staff roster, which is working a shift, not running anything (Decided, 21 Oct)';

    private const string ON_THE_NIGHT = "a waiter's tray on the night, which ends with the service";

    private const string REQUEST = 'who asked for it: a request answered or not, not something to look after';

    /** Every other field naming a person, and why it is not work a departing member hands over. */
    private const array NOT_WORK = [
        AuditExport::class . '::askedBy' => self::REQUEST,
        CalendarFeed::class . '::user' => self::ACCOUNT,
        DoorCode::class . '::madeBy' => self::HISTORY,
        DoorCodeRedemption::class . '::user' => self::WHO_JOINED,
        EmailAddress::class . '::user' => self::ACCOUNT,
        EventChange::class . '::actor' => self::HISTORY,
        EventMute::class . '::user' => self::ACCOUNT,
        EventPerson::class . '::grantedBy' => self::HISTORY,
        EventPerson::class . '::user' => self::OUTSIDE,
        Guest::class . '::addedBy' => self::HISTORY,
        Guest::class . '::arrivedBy' => self::HISTORY,
        Guest::class . '::invitedBy' => self::HISTORY,
        Guest::class . '::removedBy' => self::HISTORY,
        GuestMessage::class . '::createdBy' => self::HISTORY,
        GuestReplyLook::class . '::user' => self::ACCOUNT,
        Invitation::class . '::acceptedBy' => self::HISTORY,
        Invitation::class . '::invitedBy' => self::HISTORY,
        JoinOfferDismissal::class . '::user' => self::ACCOUNT,
        KitchenCopy::class . '::recordedBy' => self::HISTORY,
        KnownDevice::class . '::user' => self::ACCOUNT,
        MealAnswer::class . '::chosenBy' => self::HISTORY,
        Membership::class . '::user' => self::MEMBERSHIP,
        MembershipTransition::class . '::actor' => self::HISTORY,
        MembershipTransition::class . '::membership' => self::HISTORY,
        NotificationItem::class . '::user' => self::ACCOUNT,
        NotificationPreference::class . '::user' => self::ACCOUNT,
        OrganisationExport::class . '::askedBy' => self::REQUEST,
        OwnerClaim::class . '::claimant' => self::REQUEST,
        OwnerClaim::class . '::stoppedBy' => self::HISTORY,
        Passkey::class . '::user' => self::ACCOUNT,
        PasskeyChallenge::class . '::user' => self::ACCOUNT,
        PasswordResetToken::class . '::user' => self::ACCOUNT,
        PasswordSetCode::class . '::user' => self::ACCOUNT,
        PhoneNumber::class . '::user' => self::ACCOUNT,
        ProviderIdentity::class . '::user' => self::ACCOUNT,
        PushTarget::class . '::user' => self::ACCOUNT,
        RecoveryCode::class . '::user' => self::ACCOUNT,
        RefreshToken::class . '::user' => self::ACCOUNT,
        ScheduleItem::class . '::changedBy' => self::HISTORY,
        SchedulePress::class . '::pressedBy' => self::HISTORY,
        ScheduledPayment::class . '::cancelledBy' => self::HISTORY,
        ScheduledPayment::class . '::paidBy' => self::HISTORY,
        SeatingPlan::class . '::changedBy' => self::HISTORY,
        SeatingRow::class . '::changedBy' => self::HISTORY,
        SeatingSeat::class . '::changedBy' => self::HISTORY,
        SeatingSection::class . '::changedBy' => self::HISTORY,
        SeatingTable::class . '::changedBy' => self::HISTORY,
        ServiceFiring::class . '::firedBy' => self::HISTORY,
        ServiceItem::class . '::changedBy' => self::HISTORY,
        ServiceStep::class . '::by' => self::HISTORY,
        ServiceTap::class . '::by' => self::HISTORY,
        ServiceTray::class . '::waiter' => self::ON_THE_NIGHT,
        SignInProof::class . '::user' => self::ACCOUNT,
        StaffMember::class . '::account' => self::ROSTER,
        StaffMember::class . '::briefCopyBy' => self::HISTORY,
        StaffMember::class . '::linkBy' => self::HISTORY,
        StaffMember::class . '::member' => self::ROSTER,
        StaffMember::class . '::walkOnBy' => self::HISTORY,
        StaffRate::class . '::setBy' => self::HISTORY,
        TwoFactorChallenge::class . '::user' => self::ACCOUNT,
        TwoFactorFactor::class . '::user' => self::ACCOUNT,
        TwoFactorRecovery::class . '::decidedBy' => self::HISTORY,
        TwoFactorRecovery::class . '::user' => self::ACCOUNT,
    ];

    #[Test]
    public function everyFieldNamingAPersonIsWorkOrSaysWhyNot(): void
    {
        $fields = $this->fieldsNamingAPerson();
        $unclassified = Vec\filter(
            $fields,
            static fn (string $field): bool => !Iter\contains_key(ResponsibleFields::all(), $field) && !Iter\contains_key(self::NOT_WORK, $field),
        );

        self::assertSame([], $unclassified, 'A new field naming a person: add it to ResponsibleFields and WorkFinder if it makes them responsible for something, or to NOT_WORK here with the reason.');
        self::assertSame([], Vec\filter(Vec\keys(self::NOT_WORK), static fn (int|string $field): bool => !Iter\contains($fields, $field)), 'NOT_WORK names a field that is gone');
        self::assertSame([], Vec\filter(Vec\keys(ResponsibleFields::all()), static fn (int|string $field): bool => !Iter\contains($fields, $field)), 'ResponsibleFields names a field that is gone');
    }

    /** @return list<string> `Entity::property` for every association to a User or a Membership */
    private function fieldsNamingAPerson(): array
    {
        $fields = [];

        foreach (self::service(EntityManagerInterface::class)->getMetadataFactory()->getAllMetadata() as $metadata) {
            foreach ($metadata->getAssociationNames() as $association) {
                if (Iter\contains([User::class, Membership::class], $metadata->getAssociationTargetClass($association))) {
                    $fields[] = $metadata->getName() . '::' . $association;
                }
            }
        }

        return $fields;
    }
}
