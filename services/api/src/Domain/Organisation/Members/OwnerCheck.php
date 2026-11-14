<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Members;

use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Whether an account is an active Owner of an organisation: the one test behind every owner-only action. */
final readonly class OwnerCheck
{
    public function __construct(
        private MembershipRepository $membershipRepository,
        private TranslatorInterface $translator,
    ) {
    }

    public function holds(Organisation $organisation, User $user): bool
    {
        return true === $this->membershipRepository->findActive($user, $organisation->getId())?->getRole()->isOwner();
    }

    /** Refused `owner_required`, saying which action needed an owner. */
    public function require(Organisation $organisation, User $user, string $messageKey): void
    {
        if (!$this->holds($organisation, $user)) {
            throw new ApiException(ErrorCode::OwnerRequired, $this->translator->trans($messageKey));
        }
    }
}
