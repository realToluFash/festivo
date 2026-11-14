<?php

declare(strict_types=1);

namespace App\Enum;

/** Why Company domain joining refused a domain: the domain field's violation code, which the cards read (sc-11816). */
enum DomainRefusal: string
{
    case Blank = 'domain_blank';
    case Invalid = 'domain_invalid';
    case Public = 'domain_public';
    case Listed = 'domain_listed';
    case NotYours = 'domain_not_yours';
    case Full = 'domain_full';
    case ProvedElsewhere = 'domain_proved_elsewhere';
}
