<?php

declare(strict_types=1);

namespace App\Enum;

/** How an organisation's identity provider connects for single sign-on (sc-610). */
enum SsoProtocol: string
{
    case Saml = 'saml';
    case Oidc = 'oidc';
}
