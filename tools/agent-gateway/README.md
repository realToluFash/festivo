# Agent gateway

A local stand-in for `POST /v1/messages`, answered by a Claude Code worker signed in as you.
The API's Anthropic SDK cannot tell it from Anthropic. Local development only.

```sh
# once: AGENT_GATEWAY_KEY in the root .env (see .env.example)
npm run start --workspace @soirely/agent-gateway
```

One worker at a time: a second request while one runs gets `529 overloaded_error`.

## What it honours

| Request                         | What the gateway does                                                     |
| ------------------------------- | ------------------------------------------------------------------------- |
| `model`                         | passed to the worker                                                      |
| `max_tokens`                    | an answer over it is cut, `stop_reason: "max_tokens"`, usage estimated    |
| `thinking`, `output_config`     | `thinking` and `effort` passed to the worker                              |
| `system`, `cache_control`       | the system text is the worker's instructions; cache fields come back as 0 |
| `tools`                         | offered to the worker as structured output; it runs none of them          |
| `stream: true`, other endpoints | 400 and 404, naming what is not supported                                 |

A worker has no tools of its own and loads no settings from `~/.claude`. Its answer is
checked against the request's tool schemas; one that fails is asked again once, then 500.

Usage is the worker's own count. Where it has none, the gateway estimates it and says so in
the `x-soirely-usage: estimated` header.

## Tests

```sh
npm test --workspace @soirely/agent-gateway        # with a scripted worker; what CI runs
npm run test:live --workspace @soirely/agent-gateway  # a real worker; needs your Claude sign-in
```

`services/api/tests/Fixtures/AgentGateway/` holds request and response pairs in Anthropic's
shape. This suite replays each request through the gateway and keeps the `gateway` half of
the file current (`UPDATE_GOLDEN=1 npm test` rewrites it); the API's
`AgentGatewayContractTest` puts both halves through the PHP SDK and `AnthropicAssistant`.
