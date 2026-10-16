<?php

declare(strict_types=1);

namespace App\Domain\User\Phone;

use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Domain\User\Verification\VerificationCodeSender;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\PhoneNumberRepository;
use Doctrine\ORM\EntityManagerInterface;

/** A row's verification describes its number, so a changed number is a new row, not the old one cleared. */
final readonly class PrimaryPhoneSetter
{
    public function __construct(
        private PhoneNumberRepository $phoneNumberRepository,
        private VerificationCodeIssuer $verificationCodeIssuer,
        private VerificationCodeSender $verificationCodeSender,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** Null removes the phone. A new number waits beside the primary until it is verified. Answers the phone texted, or null. */
    public function set(User $user, ?ParsedPhone $phone): ?PhoneNumber
    {
        $current = $user->getPrimaryPhoneNumber();
        $pending = $user->getPendingPhoneNumber();

        if (null === $phone) {
            $this->remove($pending);
            $this->remove($current);

            return null;
        }

        if (null !== $current && $current->getNumber() === $phone->number) {
            $this->remove($pending);

            return null;
        }

        if (null !== $pending && $pending->getNumber() === $phone->number) {
            return null;
        }

        $held = $this->phoneNumberRepository->findOneByNumber($phone->number);

        if (null !== $held && $held->getUser() !== $user) {
            if ($held->isVerified()) {
                throw new ApiException(ErrorCode::PhoneTaken, 'This number is already verified on another account.');
            }

            // Never proved by whoever typed it there, so it does not keep the number from its owner.
            $this->remove($held);
            $held = null;
        }

        $next = $held ?? new PhoneNumber($user, $phone->number, false, $phone->countryCode);

        // Already proved, so the change is complete at once.
        if ($next->isVerified()) {
            $this->remove($pending);
            $this->promote($next, $current);

            return null;
        }

        $this->remove($pending);

        if (null === $current) {
            $next->setPrimary(true);
        } else {
            $next->setPending(true);
        }

        $this->entityManager->persist($next);
        $this->entityManager->flush();

        $issued = $this->verificationCodeIssuer->issueFor($next);
        $this->entityManager->flush();
        $this->verificationCodeSender->send($next, $issued->code);

        return $next;
    }

    /** After its code: a replacement takes the primary's place, and the old number goes. */
    public function verified(PhoneNumber $phone): void
    {
        if ($phone->isPending()) {
            $this->promote($phone, $phone->getUser()->getPrimaryPhoneNumber());
        }
    }

    private function promote(PhoneNumber $next, ?PhoneNumber $current): void
    {
        if ($current !== $next) {
            $this->remove($current);
        }

        $next->setPending(false);
        $next->setPrimary(true);
        $this->entityManager->persist($next);
        $this->entityManager->flush();
    }

    /** Flushed on its own: the new primary needs the old one gone first, by the one-primary index. */
    private function remove(?PhoneNumber $phone): void
    {
        if (null === $phone) {
            return;
        }

        $phone->getUser()->removePhoneNumber($phone);
        $this->entityManager->remove($phone);
        $this->entityManager->flush();
    }
}
