<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\TwoFactor\Recovery\NotMeLink;
use App\Domain\User\TwoFactor\Recovery\RecoveryView;
use App\Domain\User\TwoFactor\Recovery\TwoFactorRecoveries;
use App\Entity\TwoFactorRecovery;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\PublicAccess;
use App\Http\CodeField;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\TwoFactorRecoveryRepository;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** Lost both the authenticator and the recovery codes (sc-509): opened from the sign-in code step, then by the request's own handle. */
#[PublicAccess]
final readonly class TwoFactorRecoveryController
{
    public function __construct(
        private TwoFactorRecoveries $twoFactorRecoveries,
        private TwoFactorRecoveryRepository $twoFactorRecoveryRepository,
        private RecoveryView $recoveryView,
        private NotMeLink $notMeLink,
        private CodeField $codeField,
        private string $supportAddress,
    ) {
    }

    /** What the start screen says, and an open request to carry on with. Never sends a code. */
    #[Route('/api/auth/two-factor/recovery/opening', name: 'auth_two_factor_recovery_opening', methods: ['POST'])]
    public function opening(Request $request): JsonResponse
    {
        $user = $this->twoFactorRecoveries->personAt($this->field($request, 'challenge'));
        $resumed = $this->twoFactorRecoveries->resume($user);

        return new JsonResponse([
            ...$this->recoveryView->opening($user),
            'supportAddress' => $this->supportAddress,
            'recovery' => $resumed[1] ?? null,
            'state' => null === $resumed ? null : $this->recoveryView->state($resumed[0], $request->getLocale()),
        ]);
    }

    #[Route('/api/auth/two-factor/recovery', name: 'auth_two_factor_recovery_start', methods: ['POST'])]
    public function start(Request $request): JsonResponse
    {
        $user = $this->twoFactorRecoveries->personAt($this->field($request, 'challenge'));
        [$recovery, $handle] = $this->twoFactorRecoveries->start($user);

        return new JsonResponse(['recovery' => $handle, 'state' => $this->recoveryView->state($recovery, $request->getLocale())], Response::HTTP_CREATED);
    }

    /** Polled while the codes are out and while it waits, so it must never spend a try or send a code itself. */
    #[Route('/api/auth/two-factor/recovery/state', name: 'auth_two_factor_recovery_state', methods: ['POST'])]
    public function state(Request $request): JsonResponse
    {
        $recovery = $this->recovery($request);
        $this->twoFactorRecoveries->poll($recovery);

        return $this->answer($recovery, $request);
    }

    #[Route('/api/auth/two-factor/recovery/resend', name: 'auth_two_factor_recovery_resend', methods: ['POST'])]
    public function resend(Request $request): JsonResponse
    {
        $recovery = $this->recovery($request);
        $this->twoFactorRecoveries->resend($recovery);

        return $this->answer($recovery, $request);
    }

    #[Route('/api/auth/two-factor/recovery/text-instead', name: 'auth_two_factor_recovery_text_instead', methods: ['POST'])]
    public function textInstead(Request $request): JsonResponse
    {
        $recovery = $this->recovery($request);
        $this->twoFactorRecoveries->textInstead($recovery);

        return $this->answer($recovery, $request);
    }

    #[Route('/api/auth/two-factor/recovery/prove', name: 'auth_two_factor_recovery_prove', methods: ['POST'])]
    public function prove(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'recovery' => Type\string(),
            'emailCode' => Type\optional(Type\mixed()),
            'phoneCode' => Type\optional(Type\mixed()),
        ]));
        $recovery = $this->twoFactorRecoveries->find($body['recovery']);
        $emailCode = $this->codeField->required($body, 'emailCode', CodeField::FROM_EMAIL);
        $phoneCode = null === $recovery->getPhoneNumber() ? null : $this->codeField->required($body, 'phoneCode', CodeField::FROM_TEXT);

        $this->twoFactorRecoveries->prove($recovery, $emailCode, $phoneCode, $request->headers->get('User-Agent'));

        return $this->answer($recovery, $request);
    }

    #[Route('/api/auth/two-factor/recovery/cancel', name: 'auth_two_factor_recovery_cancel', methods: ['POST'])]
    public function cancel(Request $request): JsonResponse
    {
        $recovery = $this->recovery($request);
        $this->twoFactorRecoveries->cancel($recovery);

        return $this->answer($recovery, $request);
    }

    /** From any email about a request. The same answer whatever the link names, so it confirms nothing. */
    #[Route('/api/auth/two-factor/recovery/not-me', name: 'auth_two_factor_recovery_not_me', methods: ['POST'])]
    public function notMe(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['request' => Type\string(), 'token' => Type\string()]));
        $recovery = Uuid::isValid($body['request']) && $this->notMeLink->matches($body['request'], $body['token'])
            ? $this->twoFactorRecoveryRepository->find(Uuid::fromString($body['request']))
            : null;

        if (null === $recovery) {
            throw new ApiException(ErrorCode::RecoveryRequestInvalid, 'That link does not work.');
        }

        $this->twoFactorRecoveries->notMe($recovery->getUser());

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    private function recovery(Request $request): TwoFactorRecovery
    {
        return $this->twoFactorRecoveries->find($this->field($request, 'recovery'));
    }

    private function answer(TwoFactorRecovery $recovery, Request $request): JsonResponse
    {
        return new JsonResponse(['state' => $this->recoveryView->state($recovery, $request->getLocale())]);
    }

    private function field(Request $request, string $name): string
    {
        return Input::body($request, Type\shape([$name => Type\string()], true))[$name];
    }
}
