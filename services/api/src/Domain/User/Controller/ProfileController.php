<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Http\AccountSerialiser;
use App\Domain\User\Onboarding\DetailsSaver;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Authenticated]
final readonly class ProfileController
{
    public function __construct(
        private Security $security,
        private DetailsSaver $detailsSaver,
        private AccountSerialiser $accountSerialiser,
    ) {
    }

    /** The details screen. On the onboarding gate's exempt list, because it is how the gate is passed. */
    #[Route('/api/auth/complete-profile', name: 'auth_complete_profile', methods: ['PATCH'])]
    public function completeProfile(Request $request): JsonResponse
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
        }

        $body = Input::body($request, Type\shape([
            'name' => Type\string(),
            'organisationName' => Type\optional(Type\nullable(Type\string())),
            'countryCode' => Type\optional(Type\nullable(Type\string())),
            'timezone' => Type\optional(Type\nullable(Type\string())),
            'phoneCountryCode' => Type\optional(Type\nullable(Type\string())),
            'phoneNumber' => Type\optional(Type\nullable(Type\string())),
            // An organisation offered through the address's domain (sc-561), asked instead of founding one.
            'askToJoin' => Type\optional(Type\nullable(Type\string())),
        ]));

        $texted = $this->detailsSaver->save(
            $user,
            $body['name'],
            $body['organisationName'] ?? null,
            $body['countryCode'] ?? null,
            $body['timezone'] ?? null,
            $body['phoneCountryCode'] ?? null,
            $body['phoneNumber'] ?? null,
            $body['askToJoin'] ?? null,
        );

        return new JsonResponse([
            'account' => $this->accountSerialiser->serialise($user),
            // A changed number waits for its code even while the account still counts as verified.
            'verificationNeeded' => null !== $texted || !$user->isVerified(),
        ]);
    }
}
