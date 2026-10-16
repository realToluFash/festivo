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

    /** Null removes it. Answers the phone that now needs a code, which has been sent one, or null. */
    public function set(User $user, ?ParsedPhone $phone): ?PhoneNumber
    {
        $current = $user->getPrimaryPhoneNumber();

        if (null === $phone) {
            $this->remove($current);

            return null;
        }

        if (null !== $current && $current->getNumber() === $phone->number) {
            return null;
        }

        $held = $this->phoneNumberRepository->findOneByNumber($phone->number);

        if (null !== $held && $held->getUser() !== $user) {
            if ($held->isVerified()) {
                throw new ApiException(ErrorCode::PhoneTaken, 'This number is already verified on another account.');
            }

            // Never proved by whoever typed it there, so it does not keep the number from its owner.
            $this->remove($held);
        }

        $next = null !== $held && $held->getUser() === $user
            ? $held
            : new PhoneNumber($user, $phone->number, false, $phone->countryCode);

        $this->remove($current);
        $next->setPrimary(true);
        $this->entityManager->persist($next);
        $this->entityManager->flush();

        if ($next->isVerified()) {
            return null;
        }

        $issued = $this->verificationCodeIssuer->issueFor($next);
        $this->entityManager->flush();
        $this->verificationCodeSender->send($next, $issued->code);

        return $next;
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
