<?php

declare(strict_types=1);

namespace App\Domain\Staff\Link;

use App\Audit\Auditor;
use App\Domain\User\Mail\AccountLanguage;
use App\Domain\User\Model\IssuedChallenge;
use App\Domain\User\Model\IssuedTokens;
use App\Domain\User\PhoneSignIn\PhoneSignIns;
use App\Domain\User\TwoFactor\SignInGate;
use App\Entity\PhoneSignIn;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use SensitiveParameter;
use Symfony\Component\Clock\ClockInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Signing in at the end of a person's own link (sc-4235): one code to the number on their roster entry, which the person never types. */
final readonly class StaffLinkSignIn
{
    public const string ACCOUNT_LINKED = 'staff.account_linked';

    public function __construct(
        private StaffLinks $staffLinks,
        private PhoneSignIns $phoneSignIns,
        private SignInGate $signInGate,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** @return string the handle the code step answers with */
    public function send(StaffMember $entry, Request $request): string
    {
        $this->refuseOutsideWindow($entry);
        $mobile = $entry->getMobile() ?? throw new ApiException(ErrorCode::Conflict, $this->translator->trans('staff.link_needs_mobile'));
        $handle = PhoneSignIns::newHandle();
        $this->phoneSignIns->send(PhoneSignIn::throughLink(PhoneSignIns::hash($handle), $entry, $mobile, null, AccountLanguage::fromRequest(AccountLanguage::askedIn($request)), $this->clock->now()));

        return $handle;
    }

    /** @return array{user: User, admission: IssuedTokens|IssuedChallenge} */
    public function signIn(StaffMember $entry, #[SensitiveParameter] string $handle, #[SensitiveParameter] string $code, Request $request, bool $inBrowser): array
    {
        $signIn = $this->phoneSignIns->find($handle);

        if (true !== $signIn->getStaffMember()?->getId()->equals($entry->getId()) || $signIn->getNumber() !== $entry->getMobile()) {
            throw new ApiException(ErrorCode::VerificationCodeExpired, 'code.expired');
        }

        $this->refuseOutsideWindow($entry);
        $user = $this->phoneSignIns->prove($signIn, $code, $entry->getFullName(), $request)['user'];

        if (true !== $entry->getAccount()?->getId()->equals($user->getId())) {
            $entry->linkAccount($user);
            $this->auditor->record(self::ACCOUNT_LINKED, 'StaffMember', $entry->getId(), Actor::User, $user->getId(), $user->getName(), ['account' => [null, $user->getId()->toRfc4122()]]);
        }

        $this->phoneSignIns->signedIn($user, 'staff_link');

        return ['user' => $user, 'admission' => $this->signInGate->admit($user, $request, null, true, $inBrowser)];
    }

    private function refuseOutsideWindow(StaffMember $entry): void
    {
        if (!$this->staffLinks->window($entry)->open) {
            throw ApiException::notFound('access.not_found');
        }
    }
}
