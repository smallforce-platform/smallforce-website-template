# Workflows, Queues, and Cron Triggers

Read this reference only when the application needs durable, asynchronous, or
scheduled work. These are three independent features and may be combined.
They use Cloudflare Workers authoring contracts; do not create a SmallForce
wrapper API.

Binding access is identical across execution types: Queue and Cron handlers
receive the public environment as `env`, Workflow classes receive it as
`this.env`, and server-only code may import `env` from
`cloudflare:workers`. Do not use `context.env`, `ctx.env`, or private
`__SMALLFORCE_*` bindings.

`src/server.ts` bundles `src/background.ts` beside TanStack's HTTP handler.
Put exported Workflow classes plus the default Queue and Cron handlers in
`src/background.ts`.

## Declare the runtime types

Add explicit bindings and shared payload types to `src/env.d.ts`:

```ts
interface OrderWorkflowParams {
  orderId: string
}

interface JobMessage {
  jobId: string
  kind: "notify" | "sync"
}

interface SmallForceApplicationEnv {
  // Existing SmallForce bindings stay here.
  ORDER_WORKFLOW: Workflow<OrderWorkflowParams>
  JOBS: Queue<JobMessage>
}
```

Do not add Wrangler bindings or credentials. `wrangler.jsonc` exists only for
local Worker building and emulation; `smallforce.json` is the deploy manifest.

## Workflows

Declare each Workflow binding in `smallforce.json`:

```json
{
  "workflows": [
    {
      "name": "order-processing",
      "binding": "ORDER_WORKFLOW",
      "class_name": "OrderWorkflow"
    }
  ]
}
```

Export the named class from `src/background.ts`:

```ts
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers"

export class OrderWorkflow extends WorkflowEntrypoint<
  SmallForceApplicationEnv,
  OrderWorkflowParams
> {
  async run(event: WorkflowEvent<OrderWorkflowParams>, step: WorkflowStep) {
    const order = await step.do("load order", async () => {
      return this.env.DB.query<{ id: string; status: string }>(
        "SELECT id, status FROM orders WHERE id = ?",
        [event.payload.orderId],
      )
    })

    await step.sleep("cooldown", "5 minutes")
    return order
  }
}

export const background: ApplicationBackgroundHandlers<JobMessage> = {}
```

Start an instance from a server function through the typed binding:

```ts
const instance = await env.ORDER_WORKFLOW.create({
  id: crypto.randomUUID(),
  params: { orderId },
})
```

SmallForce manages durable steps, retries, sleeps, events, pause/resume, restart, and
crash replay. SmallForce resolves the environment's deployed release whenever
the Workflow runs. Keep the Workflow `name`, `class_name`, and persisted step
history compatible while instances remain active.

## Queues

Declare producers and same-application consumers separately:

```json
{
  "queues": {
    "producers": [{ "binding": "JOBS", "queue": "jobs" }],
    "consumers": [
      {
        "queue": "jobs",
        "max_batch_size": 25,
        "max_batch_timeout": 5,
        "max_retries": 3,
        "retry_delay": 10,
        "dead_letter_queue": "jobs-dead-letter"
      },
      { "queue": "jobs-dead-letter" }
    ]
  }
}
```

Send from server-only code:

```ts
await env.JOBS.send({ jobId: crypto.randomUUID(), kind: "sync" })
```

Implement the default Queue handler through `background`:

```ts
export const background: ApplicationBackgroundHandlers<JobMessage> = {
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      await processJob(env, message.body)
      message.ack()
    }
    ctx.waitUntil(recordDelivery(batch.queue, batch.messages.length))
  },
}
```

Normal return plus resolved `ctx.waitUntil()` work acknowledges delivery.
Thrown or rejected work retries according to the deployed release's policy.
Delivery is at least once with best-effort ordering. Make every external side
effect idempotent. V1 supports same-application push consumers and dead-letter
Queues, not pull or cross-application consumers.

## Cron Triggers

Declare UTC expressions with the standard Wrangler manifest shape:

```json
{
  "triggers": {
    "crons": ["*/5 * * * *", "0 9 * * MON-FRI"]
  }
}
```

Add the default scheduled handler to `background`:

```ts
export const background: ApplicationBackgroundHandlers<JobMessage> = {
  scheduled(controller, env, ctx) {
    ctx.waitUntil(runMaintenance(env, controller.scheduledTime))
  },
}
```

Cron Triggers support one-minute granularity and run the environment's deployed
release. Delivery and `ctx.waitUntil()` are at least once. A handler may call
`controller.noRetry()` when retrying would be unsafe, but the next scheduled
occurrence still runs. Keep scheduled side effects idempotent.

## Deploy all features together

```sh
bun run check
smallforce app deploy --json
```

TanStack HTTP code, assets, Workflow definitions, Queue configuration, and Cron
Triggers are one immutable release. Preview activates automatically;
Production requires an explicit release promotion.
