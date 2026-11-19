<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\EmailDomains\EmailDomains;
use App\Domain\Organisation\EmailDomains\OnlyOurOrganisation;
use App\Domain\Organisation\Members\OwnerCheck;
use App\Domain\User\Mail\UserMailer;
use App\Entity\EmailDomain;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\PlanFeature;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EmailDomainRepository;
use App\Repository\OrganisationRepository;
use DateTimeImmutable;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Settings › Data and control › Email domains (sc-560), for an Owner or an Admin; a Member is refused. */
#[InOrganisation(Permission::OrganisationManage, feature: PlanFeature::EmailDomains)]
final readonly class EmailDomainsController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private EmailDomainRepository $emailDomainRepository,
        private EmailDomains $emailDomains,
        private OnlyOurOrganisation $onlyOurOrganisation,
        private OwnerCheck $ownerCheck,
        private UserMailer $userMailer,
        private ClockInterface $clock,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/email-domains', name: 'orgs_email_domains', methods: ['GET'])]
    public function list(string $organisationId): JsonResponse
    {
        return new JsonResponse($this->page($this->organisation($organisationId)));
    }

    /** Refused `plan_required` off Enterprise by the access layer, and 422 on the domain field for the form's checks and the server's. */
    #[Route('/api/orgs/{organisationId}/email-domains', name: 'orgs_email_domains_add', methods: ['POST'])]
    public function add(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, Type\shape(['domain' => Type\string()]));
        $this->emailDomains->add($organisation, $this->user(), $body['domain']);

        return new JsonResponse($this->page($organisation), Response::HTTP_CREATED);
    }

    /** `found` false keeps the record open; 409 `email_domain_taken` once another organisation has proved it. */
    #[Route('/api/orgs/{organisationId}/email-domains/{domain}/verify', name: 'orgs_email_domains_verify', methods: ['POST'])]
    public function verify(string $organisationId, string $domain): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $found = $this->emailDomains->verify($organisation, $this->user(), $domain);

        return new JsonResponse(['found' => $found, ...$this->page($organisation)]);
    }

    #[Route('/api/orgs/{organisationId}/email-domains/{domain}', name: 'orgs_email_domains_remove', methods: ['DELETE'])]
    public function remove(string $organisationId, string $domain): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->emailDomains->remove($organisation, $this->user(), $domain);

        return new JsonResponse($this->page($organisation));
    }

    /** Only our organisation (sc-563): the Owner's alone, 403 `owner_required` to an Admin; 422 on a domain not proved. */
    #[Route('/api/orgs/{organisationId}/email-domains/{domain}/only-ours', name: 'orgs_email_domains_only_ours_on', methods: ['POST'])]
    public function switchOnlyOursOn(string $organisationId, string $domain): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->onlyOurOrganisation->switchOn($organisation, $this->user(), $domain);

        return new JsonResponse($this->page($organisation));
    }

    /** Cancels it while it is scheduled, switches it off once it applies. */
    #[Route('/api/orgs/{organisationId}/email-domains/{domain}/only-ours', name: 'orgs_email_domains_only_ours_off', methods: ['DELETE'])]
    public function switchOnlyOursOff(string $organisationId, string $domain): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->onlyOurOrganisation->switchOff($organisation, $this->user(), $domain);

        return new JsonResponse($this->page($organisation));
    }

    /** @return array<string, mixed> each instant twice: as it is, and written in the reader's own zone (sc-868) */
    private function page(Organisation $organisation): array
    {
        $user = $this->user();
        $now = $this->clock->now();
        $domains = $this->emailDomainRepository->findForOrganisation($organisation);
        $unlocked = $this->emailDomains->mayChange($organisation);

        return [
            'plan' => match (true) {
                $unlocked => 'enterprise',
                [] === $domains => 'free',
                default => 'left',
            },
            'ownerChanges' => $this->ownerCheck->holds($organisation, $user),
            'domains' => Vec\map($domains, fn (EmailDomain $domain): array => [
                'domain' => $domain->getDomain(),
                'status' => EmailDomains::statusOf($domain, $now),
                'record' => [
                    'type' => 'TXT',
                    'name' => EmailDomains::recordName($domain->getDomain()),
                    'value' => $domain->getRecordValue(),
                ],
                ...$this->instant('addedAt', 'added', $domain->getAddedAt(), $user),
                ...$this->instant('provedAt', 'proved', $domain->getProvedAt(), $user),
                ...$this->instant('checksEndAt', 'checksEnd', $domain->checksEndAt(), $user),
                ...$this->instant('putBackByAt', 'putBackBy', $domain->putBackBy(), $user),
                'onlyOurs' => OnlyOurOrganisation::stateOf($domain, $now),
                ...$this->instant('onlyOursFromAt', 'onlyOursFrom', $domain->getOnlyOursFrom(), $user),
                // What switching it on now would say it starts, for the Owner's confirm.
                ...$this->instant('onlyOursIfNowAt', 'onlyOursIfNow', $domain->isProved() && null === $domain->getOnlyOursFrom() ? OnlyOurOrganisation::startsIfSwitchedOnAt($now) : null, $user),
            ]),
        ];
    }

    /** @return array<string, ?string> */
    private function instant(string $atKey, string $writtenKey, ?DateTimeImmutable $at, User $user): array
    {
        return [
            $atKey => $at?->format(\DATE_ATOM),
            $writtenKey => null === $at ? null : $this->userMailer->deadline($at, $user, $this->userMailer->formattingLocaleFor($user)),
        ];
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
