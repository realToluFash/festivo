# Soirely

Event management for the people running the event — the organiser planning it, and the
staff working the floor on the night.

This is a clean restart. The previous implementation (a Go API with four satellite repos)
is preserved at `festivo-backup-pre-symfony-2026-10-11` and is not the base for anything
here; it is reference only. Every line in this repository arrives through a pull request
attached to a Shortcut epic.

## Layout

| path               | what lives there                                     |
| ------------------ | ---------------------------------------------------- |
| `apps/mobile`      | React Native (Expo) — organiser and staff app        |
| `apps/web`         | Vite + React — marketing site and guest-facing pages |
| `services/api`     | Symfony — the API, with Mercure for live updates     |
| `services/support` | Support and QA agent console                         |
| `infra`            | Docker Compose, deploy, local provider mocks         |
| `docs`             | Specs and design references                          |

One repository rather than five, because a scope of work does not respect a stack
boundary. Adding a field to the guest model touches Symfony, the mobile app and the web
guest page; as separate repos that is three pull requests that have to land in order, and
nothing to review them against each other. Here it is one.

## How work happens

1. **An epic is a scope of work**, not a stack. "Auth" is one epic covering the Symfony
   endpoints, the mobile screens and the web pages together.
2. **A story is a pull request.** Branch off `main`, open a PR, reference the Shortcut
   story so it moves itself through the workflow.
3. `main` is always deployable and is never committed to directly.

Shortcut workspace: https://app.shortcut.com/soirely

## Status

Nothing is built yet. The Foundation epic lands the toolchain, CI and the compose stack;
everything else follows it.
