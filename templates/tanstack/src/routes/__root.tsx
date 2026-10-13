import { TanStackDevtools } from "@tanstack/react-devtools"
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { AlertTriangleIcon, SearchXIcon } from "lucide-react"
import type { ReactNode } from "react"

import { AppShell } from "@/components/app-shell"
import { ThemeProvider } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { RouterContext } from "@/router"

import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Application",
      },
      {
        name: "description",
        content: "A full-stack application built on SmallForce.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  errorComponent: ({ error, reset }) => (
    <StatusView
      action={
        <Button onClick={reset} type="button">
          Try again
        </Button>
      }
      description="The application could not complete this request."
      icon={<AlertTriangleIcon />}
      title="Something went wrong"
    >
      {import.meta.env.DEV ? (
        <pre className="mt-4 max-w-2xl overflow-auto rounded-lg bg-muted p-4 text-left text-xs">
          {error instanceof Error ? error.message : "An unexpected error occurred."}
        </pre>
      ) : null}
    </StatusView>
  ),
  notFoundComponent: () => (
    <StatusView
      description="The page you requested does not exist."
      icon={<SearchXIcon />}
      title="Page not found"
    />
  ),
  shellComponent: RootDocument,
})

function StatusView({
  action,
  children,
  description,
  icon,
  title,
}: {
  action?: ReactNode
  children?: ReactNode
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-5">
          {icon}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {children}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <TooltipProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
