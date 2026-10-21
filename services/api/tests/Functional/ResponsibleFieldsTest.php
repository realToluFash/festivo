<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Handover\Model\ResponsibleField;
use App\Domain\Organisation\Handover\ResponsibleFields;
use App\Entity\EmailAddress;
use App\Entity\Invitation;
use App\Entity\JoinOfferDismissal;
use App\Entity\KnownDevice;
use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\PasswordResetToken;
use App\Entity\PasswordSetCode;
use App\Entity\PhoneNumber;
use App\Entity\ProviderIdentity;
use App\Entity\RecoveryCode;
use App\Entity\RefreshToken;
use App\Entity\SignInProof;
use App\Entity\TwoFactorChallenge;
use App\Entity\TwoFactorFactor;
use App\Entity\TwoFactorRecovery;
use App\Entity\User;
use App\Tests\FunctionalTestCase;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\File;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;

/** sc-614: a field that makes somebody responsible for something is handed over when they go, so none may be missed. */
final class ResponsibleFieldsTest extends FunctionalTestCase
{
    /** Every other field pointing at a person, and why it is not work a departing member hands over. */
    private const array NOT_WORK = [
        EmailAddress::class . '::user' => "the account's own",
        JoinOfferDismissal::class . '::user' => "the account's own",
        KnownDevice::class . '::user' => "the account's own",
        PasswordResetToken::class . '::user' => "the account's own",
        PasswordSetCode::class . '::user' => "the account's own",
        PhoneNumber::class . '::user' => "the account's own",
        ProviderIdentity::class . '::user' => "the account's own",
        RecoveryCode::class . '::user' => "the account's own",
        RefreshToken::class . '::user' => "the account's own",
        SignInProof::class . '::user' => "the account's own",
        TwoFactorChallenge::class . '::user' => "the account's own",
        TwoFactorFactor::class . '::user' => "the account's own",
        TwoFactorRecovery::class . '::user' => "the account's own",
        TwoFactorRecovery::class . '::decidedBy' => 'history: who decided',
        Invitation::class . '::invitedBy' => 'history: who invited',
        Invitation::class . '::acceptedBy' => 'history: who accepted',
        Membership::class . '::user' => 'the membership itself',
        MembershipTransition::class . '::membership' => 'history: the membership that moved',
        MembershipTransition::class . '::actor' => 'history: who moved it',
    ];

    #[Test]
    public function everyFieldPointingAtAPersonIsWorkOrSaysWhyNot(): void
    {
        $listed = Vec\map(ResponsibleFields::all(), static fn (ResponsibleField $field): string => $field->entity . '::' . $field->property);
        $unclassified = Vec\filter(
            $this->fieldsPointingAtAPerson(),
            static fn (string $field): bool => !Iter\contains($listed, $field) && !Iter\contains_key(self::NOT_WORK, $field),
        );

        self::assertSame([], $unclassified, 'A new field naming a person: add it to ResponsibleFields if it makes them responsible for something, or to NOT_WORK here with the reason.');
        $fields = $this->fieldsPointingAtAPerson();
        self::assertSame([], Vec\filter(Vec\keys(self::NOT_WORK), static fn (int|string $field): bool => !Iter\contains($fields, $field)), 'NOT_WORK names a field that is gone');
    }

    #[Test]
    public function everyListedFieldBelongsToAnOrganisationAndIsNamedInEveryLocale(): void
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $catalogues = Dict\from_keys(['en', 'es', 'fr', 'pt'], static fn (string $locale): array => Type\dict(Type\string(), Type\string())->coerce(
            Json\decode(File\read(\dirname(__DIR__, 2) . '/translations/emails.' . $locale . '.json')),
        ));

        foreach (ResponsibleFields::all() as $field) {
            $metadata = $entityManager->getClassMetadata($field->entity);
            self::assertTrue($metadata->hasAssociation('organisation'), $field->entity . ' has no organisation');
            self::assertSame(User::class, $metadata->getAssociationTargetClass($field->property), $field->property . ' names a User');
            self::assertTrue($metadata->hasField($field->titleProperty), $field->titleProperty . ' is a column');

            foreach ($catalogues as $locale => $catalogue) {
                self::assertArrayHasKey('handover.kind.' . $field->kind, $catalogue, $locale);
            }
        }
    }

    /** @return list<string> `Entity::property` for every association to a User or a Membership */
    private function fieldsPointingAtAPerson(): array
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
