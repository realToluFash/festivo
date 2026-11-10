<?php

declare(strict_types=1);

namespace App\Doctrine\Query;

use Doctrine\ORM\Query\AST\Functions\FunctionNode;
use Doctrine\ORM\Query\AST\Node;
use Doctrine\ORM\Query\Parser;
use Doctrine\ORM\Query\SqlWalker;
use Doctrine\ORM\Query\TokenType;
use Psl\Str;

/** `JSON_CONTAINS(column, :json) = true`: Postgres's `@>`, asking a JSON column whether it holds a value. */
final class JsonContains extends FunctionNode
{
    public Node $column;

    public Node $json;

    public function getSql(SqlWalker $sqlWalker): string
    {
        return Str\format('(CAST(%s AS JSONB) @> CAST(%s AS JSONB))', $sqlWalker->walkStringPrimary($this->column), $sqlWalker->walkStringPrimary($this->json));
    }

    public function parse(Parser $parser): void
    {
        $parser->match(TokenType::T_IDENTIFIER);
        $parser->match(TokenType::T_OPEN_PARENTHESIS);
        $this->column = $parser->StringPrimary();
        $parser->match(TokenType::T_COMMA);
        $this->json = $parser->StringPrimary();
        $parser->match(TokenType::T_CLOSE_PARENTHESIS);
    }
}
