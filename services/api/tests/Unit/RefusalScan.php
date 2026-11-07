<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\ProblemRenderer;
use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\Node\Name;
use PhpParser\Node\Scalar;
use PhpParser\Node\Stmt;
use PhpParser\NodeFinder;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitor\NameResolver;
use PhpParser\NodeVisitor\ParentConnectingVisitor;
use PhpParser\ParserFactory;
use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** Each value a refusal is given, followed back to the literals it is made of, wherever they are written. */
final class RefusalScan
{
    private const array SEEDS = [
        ['new ' . ApiException::class, 1],
        ['render', 2],
    ];

    private const array FORMATTING = ['sprintf', 'vsprintf', 'format'];

    /** Calls that hand an array's values on as they are. */
    private const array PASSING = ['array_values', 'values'];

    private const array TRANSLATING = ['trans'];

    /** @var array<string, list<Stmt\ClassMethod|Stmt\Function_>> */
    private array $functions = [];

    /** @var array<string, Expr> */
    private array $constants = [];

    /** @var array<string, list<Expr>> */
    private array $properties = [];

    /** @var array<string, string> a promoted property, and the constructor parameter it is */
    private array $promoted = [];

    /** @var array<string, ?string> */
    private array $parents = [];

    /** @var list<array{0: Node\ArrayItem|Expr\CallLike, 1: string}> */
    private array $sites = [];

    /** @var array<string, array<int, int>> each parameter that reaches a refusal, by function, with that refusal's lowest status */
    private array $sinks = [];

    /** @var array<int, RefusalTrace> */
    private array $traced = [];

    /** @var array<string, true> */
    private array $visiting = [];

    /** @param array<string, string> $sources the code, by the path it is reported under */
    public function __construct(array $sources)
    {
        $finder = new NodeFinder();

        foreach ($sources as $file => $code) {
            $nodes = self::parsed($code, $file);

            foreach ($finder->findInstanceOf($nodes, Stmt\ClassLike::class) as $class) {
                $this->index($class);
            }

            foreach ($finder->findInstanceOf($nodes, Stmt\Function_::class) as $function) {
                $function->setAttribute('scan.key', $function->name->toLowerString());
                $this->functions[$function->name->toLowerString()][] = $function;
            }
        }

        foreach (Vec\flatten(Vec\values($this->functions)) as $function) {
            foreach ($finder->find($function->stmts ?? [], static fn (Node $n): bool => $n instanceof Expr\CallLike || $n instanceof Node\ArrayItem) as $node) {
                if ($node instanceof Node\ArrayItem) {
                    if ($node->key instanceof Scalar\String_ && 'message' === $node->key->value) {
                        $this->sites[] = [$node, ''];
                    }

                    continue;
                }

                $call = Type\instance_of(Expr\CallLike::class)->assert($node);
                $callee = $call->isFirstClassCallable() ? null : $this->callee($call);
                if (null !== $callee) {
                    $this->sites[] = [$call, $callee];
                }
            }
        }

        foreach (self::SEEDS as [$callee, $at]) {
            $this->sinks[$callee][$at] = 400;
        }
    }

    /** @return list<string> each literal that reaches a refusal under 500, after the file and line it is written on */
    public function literals(): array
    {
        do {
            $known = Math\sum(Vec\map($this->sinks, Iter\count(...)));
            $this->each(function (Expr $sentence, int $status): void {
                foreach ($this->trace($sentence)->params as $param) {
                    [$key, $at] = Str\split($param, '#');
                    $this->sinks[$key][(int) $at] = Math\minva($this->sinks[$key][(int) $at] ?? $status, $status);
                }
            });
        } while (Math\sum(Vec\map($this->sinks, Iter\count(...))) !== $known);

        $found = [];
        $this->each(function (Expr $sentence, int $status) use (&$found): void {
            if ($status < 500) {
                $found = [...$found, ...$this->trace($sentence)->leaves];
            }
        });

        return Vec\unique($found);
    }

    /** @return list<string> */
    public function sentences(): array
    {
        return Vec\filter($this->literals(), static fn (string $leaf): bool => !Regex\matches(self::text($leaf), ProblemRenderer::KEY));
    }

    public static function text(string $leaf): string
    {
        return Str\after($leaf, ' ') ?? '';
    }

    /** @return array<Node> */
    private static function parsed(string $code, string $file): array
    {
        $nodes = new NodeTraverser(new NameResolver(), new ParentConnectingVisitor())->traverse(new ParserFactory()->createForHostVersion()->parse($code) ?? []);

        $classes = [];
        foreach (new NodeFinder()->findInstanceOf($nodes, Stmt\ClassLike::class) as $class) {
            foreach (new NodeFinder()->find($class->stmts, static fn (): bool => true) as $node) {
                $classes[\spl_object_id($node)] = $class->namespacedName?->toString();
            }
        }

        // Only what the scan reads is kept, or all of src does not fit in the suite's memory.
        foreach (new NodeFinder()->find($nodes, static fn (): bool => true) as $node) {
            $node->setAttributes([
                'startLine' => $node->getStartLine(),
                'parent' => $node->getAttribute('parent'),
                'scan.file' => $file,
                'scan.class' => $classes[\spl_object_id($node)] ?? null,
            ]);
        }

        return $nodes;
    }

    private function index(Stmt\ClassLike $class): void
    {
        $name = $class->namespacedName?->toString();
        if (null === $name) {
            return;
        }

        $this->parents[$name] = $class instanceof Stmt\Class_ ? $class->extends?->toString() : null;

        foreach ($class->getConstants() as $group) {
            foreach ($group->consts as $const) {
                $this->constants[$name . '::' . $const->name->toString()] = $const->value;
            }
        }

        foreach ($class->getProperties() as $group) {
            foreach ($group->props as $property) {
                if (null !== $property->default) {
                    $this->properties[$name . '::' . $property->name->toString()][] = $property->default;
                }
            }
        }

        foreach ($class->getMethods() as $method) {
            $key = '__construct' === $method->name->toLowerString() ? 'new ' . $name : $method->name->toLowerString();
            $method->setAttribute('scan.key', $key);
            $this->functions[$key][] = $method;

            foreach ($method->params as $at => $param) {
                if (0 !== $param->flags && $param->var instanceof Expr\Variable && \is_string($param->var->name)) {
                    $this->promoted[$name . '::' . $param->var->name] = $key . '#' . $at;
                }
            }
        }

        foreach (self::assignments($class->getMethods()) as $assign) {
            $target = $assign->var;
            $property = match (true) {
                $target instanceof Expr\PropertyFetch && $target->name instanceof Node\Identifier => $target->name->toString(),
                $target instanceof Expr\StaticPropertyFetch && $target->name instanceof Node\VarLikeIdentifier => $target->name->toString(),
                default => null,
            };
            if (null !== $property) {
                $this->properties[$name . '::' . $property][] = $assign->expr;
            }
        }
    }

    /** @param callable(Expr, int): void $visit each argument a refusal's sentence is passed in, and each violation's message */
    private function each(callable $visit): void
    {
        foreach ($this->sites as [$node, $callee]) {
            if ($node instanceof Node\ArrayItem) {
                $visit($node->value, 422);

                continue;
            }

            $status = $this->statusOf($node->getArgs());
            foreach ($this->sinks[$callee] ?? [] as $at => $lowest) {
                $argument = $this->argument($node->getArgs(), $callee, $at);
                if (null !== $argument) {
                    $visit($argument, $status ?? $lowest);
                }
            }
        }
    }

    private function trace(?Expr $expr): RefusalTrace
    {
        if (null === $expr) {
            return new RefusalTrace();
        }

        $traced = $this->traced[\spl_object_id($expr)] ?? $this->traceAnew($expr);
        $this->traced[\spl_object_id($expr)] = $traced;

        return $traced;
    }

    private function traceAnew(Expr $expr): RefusalTrace
    {
        $where = self::fileOf($expr) . ':' . $expr->getStartLine() . ' ';

        return match (true) {
            $expr instanceof Scalar\String_ => new RefusalTrace('' === $expr->value ? [] : [$where . $expr->value]),
            $expr instanceof Scalar\InterpolatedString => new RefusalTrace([$where . self::written($expr)]),
            $expr instanceof Expr\BinaryOp\Concat, $expr instanceof Expr\BinaryOp\Coalesce => $this->all($expr->left, $expr->right),
            $expr instanceof Expr\Ternary => $this->all($expr->if ?? $expr->cond, $expr->else),
            $expr instanceof Expr\Match_ => $this->all(...Vec\map($expr->arms, static fn (Node\MatchArm $arm): Expr => $arm->body)),
            $expr instanceof Expr\Cast\String_ => $this->trace($expr->expr),
            $expr instanceof Expr\ArrayDimFetch => $this->trace($expr->var),
            $expr instanceof Expr\Array_ => $this->all(...Vec\map($expr->items, static fn (Node\ArrayItem $item): Expr => $item->value)),
            $expr instanceof Expr\Variable => $this->variable($expr),
            $expr instanceof Expr\ClassConstFetch => $this->constant($expr),
            $expr instanceof Expr\PropertyFetch, $expr instanceof Expr\NullsafePropertyFetch => $this->property($expr),
            $expr instanceof Expr\StaticPropertyFetch => $this->staticProperty($expr),
            $expr instanceof Expr\CallLike => $this->returned($expr),
            default => new RefusalTrace(),
        };
    }

    private function all(?Expr ...$exprs): RefusalTrace
    {
        return Iter\reduce($exprs, fn (RefusalTrace $traced, ?Expr $expr): RefusalTrace => $traced->and($this->trace($expr)), new RefusalTrace());
    }

    private function variable(Expr\Variable $variable): RefusalTrace
    {
        $function = self::functionAround($variable);
        $key = $function?->getAttribute('scan.key');
        $name = $variable->name;
        if (null === $function || !\is_string($key) || !\is_string($name)) {
            return new RefusalTrace();
        }

        $params = [];
        $sources = [];
        foreach ($function->params as $at => $param) {
            if ($param->var instanceof Expr\Variable && $param->var->name === $name) {
                $params[] = $key . '#' . $at;
                $sources = null === $param->default ? $sources : [...$sources, $param->default];
            }
        }

        $finder = new NodeFinder();
        foreach (self::assignments($function->stmts ?? []) as $assign) {
            if (self::assigns($assign->var, $name)) {
                $sources[] = $assign->expr;
            }
        }

        // A closure's parameter is filled in from what the closure is handed over with, as by a map.
        foreach ($finder->findInstanceOf($function->stmts ?? [], Node\FunctionLike::class) as $closure) {
            $named = Iter\any($closure->getParams(), static fn (Node\Param $param): bool => $param->var instanceof Expr\Variable && $param->var->name === $name);
            $call = $closure->getAttribute('parent')?->getAttribute('parent');
            if ($named && $call instanceof Expr\CallLike && !$call->isFirstClassCallable()) {
                foreach ($call->getArgs() as $arg) {
                    $sources = $arg->value === $closure ? $sources : [...$sources, $arg->value];
                }
            }
        }

        return new RefusalTrace([], $params)->and($this->guarded('var:' . $key . ':' . $name, fn (): RefusalTrace => $this->all(...$sources)));
    }

    private function constant(Expr\ClassConstFetch $fetch): RefusalTrace
    {
        $class = $fetch->class instanceof Name ? $this->className($fetch->class, $fetch) : null;
        if (null === $class || !$fetch->name instanceof Node\Identifier) {
            return new RefusalTrace();
        }

        for ($owner = $class; null !== $owner; $owner = $this->parents[$owner] ?? null) {
            $value = $this->constants[$owner . '::' . $fetch->name->toString()] ?? null;
            if (null !== $value) {
                return $this->guarded('const:' . $owner . '::' . $fetch->name->toString(), fn (): RefusalTrace => $this->trace($value));
            }
        }

        return new RefusalTrace();
    }

    private function property(Expr\PropertyFetch|Expr\NullsafePropertyFetch $fetch): RefusalTrace
    {
        $class = self::classOf($fetch);
        if (null === $class || !$fetch->var instanceof Expr\Variable || 'this' !== $fetch->var->name || !$fetch->name instanceof Node\Identifier) {
            return new RefusalTrace();
        }

        $traced = new RefusalTrace();
        for ($owner = $class; null !== $owner; $owner = $this->parents[$owner] ?? null) {
            $name = $owner . '::' . $fetch->name->toString();
            $promoted = $this->promoted[$name] ?? null;
            $traced = $traced->and(new RefusalTrace([], null === $promoted ? [] : [$promoted]));

            foreach ($this->properties[$name] ?? [] as $assigned) {
                $traced = $traced->and($this->guarded('prop:' . $name . ':' . \spl_object_id($assigned), fn (): RefusalTrace => $this->trace($assigned)));
            }
        }

        return $traced;
    }

    private function staticProperty(Expr\StaticPropertyFetch $fetch): RefusalTrace
    {
        $class = $fetch->class instanceof Name ? $this->className($fetch->class, $fetch) : null;
        if (null === $class || !$fetch->name instanceof Node\VarLikeIdentifier) {
            return new RefusalTrace();
        }

        $traced = new RefusalTrace();
        for ($owner = $class; null !== $owner; $owner = $this->parents[$owner] ?? null) {
            $name = $owner . '::' . $fetch->name->toString();
            foreach ($this->properties[$name] ?? [] as $assigned) {
                $traced = $traced->and($this->guarded('prop:' . $name . ':' . \spl_object_id($assigned), fn (): RefusalTrace => $this->trace($assigned)));
            }
        }

        return $traced;
    }

    private function returned(Expr\CallLike $call): RefusalTrace
    {
        if ($call->isFirstClassCallable()) {
            return new RefusalTrace();
        }

        $first = $call->getArgs()[0]->value ?? null;
        $function = $call instanceof Expr\FuncCall && $call->name instanceof Name ? $call->name->getLast() : '';
        if (Iter\contains(self::FORMATTING, Str\lowercase($function)) || Iter\contains(self::PASSING, Str\lowercase($function))) {
            return $this->trace($first);
        }

        if (($call instanceof Expr\MethodCall || $call instanceof Expr\NullsafeMethodCall) && $call->name instanceof Node\Identifier && Iter\contains(self::TRANSLATING, $call->name->toLowerString())) {
            return $this->trace($first);
        }

        $callee = self::ownCall($call) ? $this->callee($call) : null;
        if (null === $callee) {
            return new RefusalTrace();
        }

        $traced = new RefusalTrace();
        foreach ($this->functions[$callee] ?? [] as $definition) {
            $returns = Vec\map(new NodeFinder()->findInstanceOf($definition->stmts ?? [], Stmt\Return_::class), static fn (Stmt\Return_ $r): ?Expr => $r->expr);
            $returned = $this->guarded('returns:' . $callee, fn (): RefusalTrace => $this->all(...$returns));
            $traced = $traced->and(new RefusalTrace($returned->leaves));

            foreach ($returned->params as $param) {
                [$key, $at] = Str\split($param, '#');
                $traced = $traced->and($key === $callee ? $this->trace($this->argument($call->getArgs(), $callee, (int) $at)) : new RefusalTrace([], [$param]));
            }
        }

        return $traced;
    }

    private function callee(Expr\CallLike $call): ?string
    {
        return match (true) {
            $call instanceof Expr\New_ => $call->class instanceof Name ? $this->constructorOf($this->className($call->class, $call)) : null,
            $call instanceof Expr\StaticCall && $call->name instanceof Node\Identifier && '__construct' === $call->name->toLowerString() => $call->class instanceof Name
                ? $this->constructorOf($this->className($call->class, $call))
                : null,
            $call instanceof Expr\StaticCall, $call instanceof Expr\MethodCall, $call instanceof Expr\NullsafeMethodCall => $call->name instanceof Node\Identifier ? $call->name->toLowerString() : null,
            $call instanceof Expr\FuncCall => $call->name instanceof Name ? Str\lowercase($call->name->getLast()) : null,
            default => null,
        };
    }

    /** A call to this class's own code, or to named code: a getter on another object is not followed. */
    private static function ownCall(Expr\CallLike $call): bool
    {
        return match (true) {
            $call instanceof Expr\MethodCall, $call instanceof Expr\NullsafeMethodCall => $call->var instanceof Expr\Variable && 'this' === $call->var->name,
            $call instanceof Expr\StaticCall, $call instanceof Expr\FuncCall => true,
            default => false,
        };
    }

    private function constructorOf(?string $class): ?string
    {
        for ($owner = $class; null !== $owner; $owner = $this->parents[$owner] ?? null) {
            if (Iter\contains_key($this->functions, 'new ' . $owner)) {
                return 'new ' . $owner;
            }
        }

        return null === $class ? null : 'new ' . $class;
    }

    private function className(Name $name, Node $at): ?string
    {
        $class = self::classOf($at);

        return match ($name->toLowerString()) {
            'self', 'static' => $class,
            'parent' => null === $class ? null : $this->parents[$class] ?? null,
            default => $name->toString(),
        };
    }

    /** @param array<Node\Arg> $args */
    private function argument(array $args, string $callee, int $at): ?Expr
    {
        $name = null;
        foreach ($this->functions[$callee] ?? [] as $definition) {
            $param = $definition->params[$at]->var ?? null;
            $name ??= $param instanceof Expr\Variable && \is_string($param->name) ? $param->name : null;
        }

        foreach (Vec\values($args) as $position => $arg) {
            if (null === $arg->name ? $position === $at : $arg->name->toString() === $name) {
                return $arg->unpack ? null : $arg->value;
            }
        }

        return null;
    }

    /** @param array<Node\Arg> $args */
    private function statusOf(array $args): ?int
    {
        foreach ($args as $arg) {
            $value = $arg->value;
            $case = $value instanceof Expr\ClassConstFetch && $value->name instanceof Node\Identifier ? $value->name->toString() : null;
            if (null !== $case && $value instanceof Expr\ClassConstFetch && $value->class instanceof Name && ErrorCode::class === $this->className($value->class, $value)) {
                $case = \constant(ErrorCode::class . '::' . $case);
                if ($case instanceof ErrorCode) {
                    return $case->status();
                }
            }
        }

        return null;
    }

    /** @param callable(): RefusalTrace $trace */
    private function guarded(string $what, callable $trace): RefusalTrace
    {
        if (Iter\contains_key($this->visiting, $what)) {
            return new RefusalTrace();
        }

        $this->visiting[$what] = true;

        try {
            return $trace();
        } finally {
            $this->visiting = Dict\filter_keys($this->visiting, static fn (string $key): bool => $key !== $what);
        }
    }

    /**
     * @param array<Node> $nodes
     *
     * @return list<Expr\Assign|Expr\AssignOp>
     */
    private static function assignments(array $nodes): array
    {
        return Vec\map(
            new NodeFinder()->find($nodes, static fn (Node $n): bool => $n instanceof Expr\Assign || $n instanceof Expr\AssignOp\Concat || $n instanceof Expr\AssignOp\Coalesce),
            static fn (Node $n): Expr\Assign|Expr\AssignOp => Type\union(Type\instance_of(Expr\Assign::class), Type\instance_of(Expr\AssignOp::class))->assert($n),
        );
    }

    private static function assigns(Expr $target, string $name): bool
    {
        return match (true) {
            $target instanceof Expr\Variable => $target->name === $name,
            $target instanceof Expr\ArrayDimFetch => self::assigns($target->var, $name),
            default => false,
        };
    }

    private static function functionAround(Node $node): Stmt\ClassMethod|Stmt\Function_|null
    {
        for ($at = $node->getAttribute('parent'); $at instanceof Node; $at = $at->getAttribute('parent')) {
            if ($at instanceof Stmt\ClassMethod || $at instanceof Stmt\Function_) {
                return $at;
            }
        }

        return null;
    }

    private static function fileOf(Node $node): string
    {
        return Type\string()->assert($node->getAttribute('scan.file'));
    }

    private static function classOf(Node $node): ?string
    {
        return Type\nullable(Type\string())->assert($node->getAttribute('scan.class'));
    }

    private static function written(Scalar\InterpolatedString $string): string
    {
        return Str\join(Vec\map($string->parts, static fn (Node $part): string => $part instanceof Node\InterpolatedStringPart ? $part->value : '{…}'), '');
    }
}
