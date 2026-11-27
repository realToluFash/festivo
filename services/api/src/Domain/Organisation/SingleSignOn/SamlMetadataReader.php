<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn;

use App\Domain\Organisation\SingleSignOn\Model\SamlMetadata;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMNodeList;
use DOMXPath;
use Psl\Regex;
use Psl\Str;
use Psl\Vec;

/** Reads an identity provider's SAML metadata: its entity id, the HTTP-Redirect sign-on service, and its signing certificates. */
final readonly class SamlMetadataReader
{
    private const string METADATA = 'urn:oasis:names:tc:SAML:2.0:metadata';
    private const string SIGNATURE = 'http://www.w3.org/2000/09/xmldsig#';
    private const string REDIRECT = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect';

    /** Null when it is not metadata Soirely can sign people in with. */
    public function read(string $xml): ?SamlMetadata
    {
        if (Str\contains($xml, '<!DOCTYPE')) {
            return null;
        }

        $document = new DOMDocument();
        $previous = \libxml_use_internal_errors(true);
        $loaded = $document->loadXML($xml, \LIBXML_NONET);
        \libxml_clear_errors();
        \libxml_use_internal_errors($previous);

        if (!$loaded) {
            return null;
        }

        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('md', self::METADATA);
        $xpath->registerNamespace('ds', self::SIGNATURE);

        $entity = $xpath->query('//md:EntityDescriptor[md:IDPSSODescriptor]')->item(0);

        if (!$entity instanceof DOMElement || '' === $entity->getAttribute('entityID')) {
            return null;
        }

        $signOn = $xpath->query(Str\format('md:IDPSSODescriptor/md:SingleSignOnService[@Binding="%s"]', self::REDIRECT), $entity)->item(0);
        $signOnUrl = $signOn instanceof DOMElement ? Str\trim($signOn->getAttribute('Location')) : '';

        if (!Regex\matches($signOnUrl, '/^https:\/\/\S+$/i')) {
            return null;
        }

        $certificates = [];

        $nodes = $xpath->query('md:IDPSSODescriptor/md:KeyDescriptor[not(@use) or @use="signing"]//ds:X509Certificate', $entity);

        foreach ($nodes instanceof DOMNodeList ? $nodes : [] as $node) {
            $certificate = $node instanceof DOMNode ? Regex\replace($node->textContent, '/\s+/', '') : '';

            if ('' !== $certificate && false !== \base64_decode($certificate, true)) {
                $certificates[] = $certificate;
            }
        }

        $certificates = Vec\unique($certificates);

        if ([] === $certificates) {
            return null;
        }

        return new SamlMetadata($entity->getAttribute('entityID'), $signOnUrl, $certificates);
    }
}
