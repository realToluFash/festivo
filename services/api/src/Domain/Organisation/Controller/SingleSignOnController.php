<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Billing\Entitlements;
use App\Domain\Organisation\Members\OwnerCheck;
use App\Domain\Organisation\SingleSignOn\ServiceUrls;
use App\Domain\Organisation\SingleSignOn\SingleSignOnSettings;
use App\Domain\Organisation\SingleSignOn\TestSignOn;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Entity\SsoProvider;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\PlanFeature;
use App\Enum\SsoProtocol;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\OrganisationRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** Settings › Sign-in rules › Single sign-on (sc-610): an Admin reads it, only an Owner changes it, and only on Enterprise. */
#[InOrganisation(Permission::OrganisationManage, feature: PlanFeature::EmailDomains)]
final readonly class SingleSignOnController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private SingleSignOnSettings $settings,
        private ServiceUrls $serviceUrls,
        private OwnerCheck $ownerCheck,
        private Entitlements $entitlements,
        private UserMailer $userMailer,
        private TestSignOn $testSignOn,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/single-sign-on', name: 'orgs_sso', methods: ['GET'])]
    public function show(string $organisationId): JsonResponse
    {
        return new JsonResponse($this->page($this->organisation($organisationId)));
    }

    /** Saves the provider, switching nothing on; 422 on the field the provider's documents could not be read from. */
    #[Route('/api/orgs/{organisationId}/single-sign-on/provider', name: 'orgs_sso_save', methods: ['PUT'])]
    public function save(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, Type\shape([
            'protocol' => Type\string(),
            'name' => Type\string(),
            'metadataUrl' => Type\optional(Type\nullable(Type\string())),
            'metadataXml' => Type\optional(Type\nullable(Type\string())),
            'metadataFileName' => Type\optional(Type\nullable(Type\string())),
            'issuer' => Type\optional(Type\nullable(Type\string())),
            'clientId' => Type\optional(Type\nullable(Type\string())),
            'clientSecret' => Type\optional(Type\nullable(Type\string())),
        ]));
        $this->settings->save($organisation, $this->user(), $body);

        return new JsonResponse($this->page($organisation));
    }

    #[Route('/api/orgs/{organisationId}/single-sign-on/provider', name: 'orgs_sso_remove', methods: ['DELETE'])]
    public function remove(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->settings->remove($organisation, $this->user());

        return new JsonResponse($this->page($organisation));
    }

    /** The address at the provider for the Owner's browser to open; the result shows on this page's next read. */
    #[Route('/api/orgs/{organisationId}/single-sign-on/test', name: 'orgs_sso_test', methods: ['POST'])]
    public function test(string $organisationId): JsonResponse
    {
        return new JsonResponse(['authorizationUrl' => $this->testSignOn->start($this->organisation($organisationId), $this->user())]);
    }

    /** 409 `sso_untested` until a test has worked. */
    #[Route('/api/orgs/{organisationId}/single-sign-on/on', name: 'orgs_sso_on', methods: ['POST'])]
    public function switchOn(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->settings->switchOn($organisation, $this->user());

        return new JsonResponse($this->page($organisation));
    }

    /** 409 `sso_required_on` while required sign-on is on. */
    #[Route('/api/orgs/{organisationId}/single-sign-on/on', name: 'orgs_sso_off', methods: ['DELETE'])]
    public function switchOff(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->settings->switchOff($organisation, $this->user());

        return new JsonResponse($this->page($organisation));
    }

    #[Route('/api/orgs/{organisationId}/single-sign-on/required', name: 'orgs_sso_required_on', methods: ['POST'])]
    public function require(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->settings->require($organisation, $this->user());

        return new JsonResponse($this->page($organisation));
    }

    #[Route('/api/orgs/{organisationId}/single-sign-on/required', name: 'orgs_sso_required_off', methods: ['DELETE'])]
    public function unrequire(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->settings->unrequire($organisation, $this->user());

        return new JsonResponse($this->page($organisation));
    }

    /** @return array<string, mixed> */
    private function page(Organisation $organisation): array
    {
        $user = $this->user();
        $current = $this->settings->current($organisation);
        $staying = $this->settings->staying($organisation);
        $domains = $this->settings->domains($organisation);
        $testedAt = $current?->getTestedAt();

        return [
            'plan' => $this->entitlements->of($organisation->getId())->unlocks(PlanFeature::EmailDomains) ? 'enterprise' : 'free',
            'ownerChanges' => $this->ownerCheck->holds($organisation, $user),
            'domains' => $domains,
            'provider' => null === $current ? null : $this->provider($current),
            'staying' => null === $staying ? null : $this->provider($staying),
            'test' => match (true) {
                null === $current?->getTestedAt() => 'untested',
                null !== $current->getTestFailure() => 'failed',
                default => 'passed',
            },
            'testedAt' => $current?->getTestedAt()?->format(\DATE_ATOM),
            'tested' => null === $testedAt ? null : $this->userMailer->deadline($testedAt, $user, $this->userMailer->formattingLocaleFor($user)),
            'testedEmail' => $current?->getTestedEmail(),
            'testedName' => $current?->getTestedName(),
            'testFailure' => $current?->getTestFailure(),
            'testFailureFromProvider' => true === $current?->isTestFailureFromProvider(),
            'on' => true === $current?->isOn(),
            'required' => null !== $organisation->getSsoRequiredSince(),
            'ours' => [
                'saml' => [
                    'entityId' => $this->serviceUrls->samlEntityId($organisation),
                    'replyUrl' => $this->serviceUrls->samlReplyUrl($organisation),
                    'metadataUrl' => $this->serviceUrls->samlMetadataUrl($organisation),
                ],
                'oidc' => [
                    'redirectUrl' => $this->serviceUrls->oidcRedirectUrl($organisation),
                ],
            ],
        ];
    }

    /** @return array<string, mixed> never the client secret */
    private function provider(SsoProvider $provider): array
    {
        return [
            'protocol' => $provider->getProtocol()->value,
            'name' => $provider->getName(),
            'way' => SsoProtocol::Saml === $provider->getProtocol() && null === $provider->getMetadataUrl() ? 'file' : 'url',
            'url' => $provider->getMetadataUrl(),
            'file' => $provider->getMetadataFileName(),
            'issuer' => $provider->getOidcIssuer(),
            'clientId' => $provider->getOidcClientId(),
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
