<?php

declare(strict_types=1);

namespace App\Domain\User\Contacts;

use App\Audit\Auditor;
use App\Domain\User\EmailAddressNormaliser;
use App\Domain\User\Phone\ParsedPhone;
use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Domain\User\Verification\VerificationCodeSender;
use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\EmailAddressRepository;
use App\Repository\PhoneNumberRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** sc-113: a primary identifies, an alternative only reaches, so nothing here lets one sign anybody in. */
final readonly class LinkedContacts
{
    /** Primary included, for each kind: a row count per user is no index's to hold. */
    public const int MOST = 2;

    public function __construct(
        private EmailAddressRepository $emailAddressRepository,
        private PhoneNumberRepository $phoneNumberRepository,
        private VerificationCodeIssuer $verificationCodeIssuer,
        private VerificationCodeSender $verificationCodeSender,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private RateLimiterFactoryInterface $contactAddAccountLimiter,
    ) {
    }

    public function addEmail(User $user, string $typed): EmailAddress
    {
        $address = EmailAddressNormaliser::normalise($typed);

        if (!\filter_var($address, \FILTER_VALIDATE_EMAIL)) {
            throw ApiException::validation([[
                'propertyPath' => 'address',
                'message' => $this->translator->trans('validation.email_invalid'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $this->spendAnAdd($user);

        return Type\instance_of(EmailAddress::class)->coerce($this->adding($user, function () use ($user, $address): EmailAddress|ApiException {
            if (Iter\count($user->getEmailAddresses()) >= self::MOST) {
                return $this->refusal(ErrorCode::AddressLimitReached, 'contacts.limit_email', ['{count}' => (string) self::MOST]);
            }

            // One answer whether it is this account's or somebody else's: anything more is an existence oracle.
            if (null !== $this->emailAddressRepository->findOneByAddress($address)) {
                return $this->refusal(ErrorCode::AlreadyLinked, 'contacts.already_linked');
            }

            $added = new EmailAddress($user, Type\non_empty_string()->assert($address));
            $this->entityManager->persist($added);
            $this->record($user, 'email.added', 'email', null, $address);

            return $added;
        }));
    }

    public function addPhone(User $user, ParsedPhone $phone): PhoneNumber
    {
        $this->spendAnAdd($user);

        return Type\instance_of(PhoneNumber::class)->coerce($this->adding($user, function () use ($user, $phone): PhoneNumber|ApiException {
            $linked = Vec\filter($user->getPhoneNumbers(), static fn (PhoneNumber $held): bool => !$held->isPending());

            if (Iter\count($linked) >= self::MOST) {
                return $this->refusal(ErrorCode::AddressLimitReached, 'contacts.limit_phone', ['{count}' => (string) self::MOST]);
            }

            if (null !== $this->phoneNumberRepository->findOneByNumber($phone->number)) {
                return $this->refusal(ErrorCode::AlreadyLinked, 'contacts.already_linked');
            }

            $added = new PhoneNumber($user, $phone->number, false, $phone->countryCode);
            $user->addPhoneNumber($added);
            $this->entityManager->persist($added);
            $this->record($user, 'phone.added', 'phone', null, $phone->number);

            return $added;
        }));
    }

    public function makeEmailPrimary(User $user, Uuid $id): EmailAddress
    {
        $address = $this->ownEmail($user, $id);

        if (!$address->isVerified()) {
            throw $this->refusal(ErrorCode::AddressNotVerified, 'contacts.not_verified_email');
        }

        $before = $user->getPrimaryEmailAddress();
        $this->entityManager->wrapInTransaction(function () use ($user, $address, $before): void {
            $this->lock($user);
            $before?->setPrimary(false);
            $this->entityManager->flush();
            $address->setPrimary(true);
            $this->record($user, 'email.primary', 'primary', $before?->getAddress(), $address->getAddress());
            $this->entityManager->flush();
        });

        return $address;
    }

    public function makePhonePrimary(User $user, Uuid $id): PhoneNumber
    {
        $phone = $this->ownPhone($user, $id);

        if (!$phone->isVerified()) {
            throw $this->refusal(ErrorCode::AddressNotVerified, 'contacts.not_verified_phone');
        }

        $before = $user->getPrimaryPhoneNumber();
        $this->entityManager->wrapInTransaction(function () use ($user, $phone, $before): void {
            $this->lock($user);
            $before?->setPrimary(false);
            $this->entityManager->flush();
            $phone->setPrimary(true);
            $this->record($user, 'phone.primary', 'primary', $before?->getNumber(), $phone->getNumber());
            $this->entityManager->flush();
        });

        return $phone;
    }

    public function removeEmail(User $user, Uuid $id): void
    {
        $address = $this->ownEmail($user, $id);

        if ($address->isPrimary()) {
            throw $this->refusal(ErrorCode::PrimaryAddress, 'contacts.primary_email');
        }

        $verified = Vec\filter($user->getEmailAddresses(), static fn (EmailAddress $held): bool => $held->isVerified());

        if ($address->isVerified() && 1 === Iter\count($verified)) {
            throw $this->refusal(ErrorCode::LastVerifiedAddress, 'contacts.last_verified_email');
        }

        $user->removeEmailAddress($address);
        $this->entityManager->remove($address);
        $this->record($user, 'email.removed', 'email', $address->getAddress(), null);
        $this->entityManager->flush();
    }

    public function removePhone(User $user, Uuid $id): void
    {
        $phone = $this->ownPhone($user, $id);

        if ($phone->isPrimary()) {
            throw $this->refusal(ErrorCode::PrimaryAddress, 'contacts.primary_phone');
        }

        $verified = Vec\filter($user->getPhoneNumbers(), static fn (PhoneNumber $held): bool => $held->isVerified());

        if ($phone->isVerified() && 1 === Iter\count($verified)) {
            throw $this->refusal(ErrorCode::LastVerifiedAddress, 'contacts.last_verified_phone');
        }

        $user->removePhoneNumber($phone);
        $this->entityManager->remove($phone);
        $this->record($user, 'phone.removed', 'phone', $phone->getNumber(), null);
        $this->entityManager->flush();
    }

    /** Another account's id answers not_found, never forbidden: the difference would confirm the row exists. */
    private function ownEmail(User $user, Uuid $id): EmailAddress
    {
        return Iter\search($user->getEmailAddresses(), static fn (EmailAddress $held): bool => $held->getId()->equals($id))
            ?? throw ApiException::notFound('That address is not linked to this account.');
    }

    private function ownPhone(User $user, Uuid $id): PhoneNumber
    {
        return Iter\search($user->getPhoneNumbers(), static fn (PhoneNumber $held): bool => $held->getId()->equals($id) && !$held->isPending())
            ?? throw ApiException::notFound('That number is not linked to this account.');
    }

    /** @param callable(): (EmailAddress|PhoneNumber|ApiException) $add returned, not thrown: a throw closes the manager */
    private function adding(User $user, callable $add): EmailAddress|PhoneNumber
    {
        $added = $this->entityManager->wrapInTransaction(function () use ($user, $add): EmailAddress|PhoneNumber|ApiException {
            $this->lock($user);

            return $add();
        });

        if ($added instanceof ApiException) {
            throw $added;
        }

        $issued = $this->verificationCodeIssuer->issueFor($added);
        $this->entityManager->flush();
        $this->verificationCodeSender->send($added, $issued);

        return $added;
    }

    /** Each add sends a code from our domain to an address the caller chose. */
    private function spendAnAdd(User $user): void
    {
        $limit = $this->contactAddAccountLimiter->create($user->getId()->toRfc4122())->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('Too many tries.', $limit->getRetryAfter());
        }
    }

    private function lock(User $user): void
    {
        $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE);
    }

    private function record(User $user, string $action, string $field, ?string $before, ?string $after): void
    {
        $this->auditor->record($action, 'Account', $user->getId(), Actor::User, $user->getId(), $user->getName(), [$field => [$before, $after]]);
    }

    /** @param array<string, string> $parameters */
    private function refusal(ErrorCode $code, string $key, array $parameters = []): ApiException
    {
        return new ApiException($code, $this->translator->trans($key, $parameters));
    }
}
