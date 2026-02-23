# AGENTS.md - Agent Context Entrypoint

> **For AI Agents**: This repository uses a modular context system to provide you with the most up-to-date and relevant information for your tasks. 
> 
> **Do NOT read this entire project structure if you only need a specific piece of information. Read ONLY the specific `.agent/context/` files relevant to your task.**

## Context Directory (`.agent/context/`)

Please use the `view_file` tool to read the specific documentation that pertains to your current task:

- **[.agent/context/architecture.md](.agent/context/architecture.md)**: Read this to understand the Converged Workspace Engine, Window Manager, and Top NavBar layout system.
- **[.agent/context/state-management.md](.agent/context/state-management.md)**: Read this to understand our usage of global Zustand singleton stores and `localStorage` persistence.
- **[.agent/context/data-layer.md](.agent/context/data-layer.md)**: Read this to understand the underlying static JSON file structures, `metadata.json`, and the modifier (`extra`) system for units and weapons.
- **[.agent/context/testing.md](.agent/context/testing.md)**: Read this to understand the differences between our Vitest unit tests and Playwright E2E tests, and how to run them.
- **[.agent/context/styling.md](.agent/context/styling.md)**: Read this to understand our styling conventions involving Tailwind CSS v4 and CSS Custom Properties.

## Workflows (`.agent/workflows/`)

For specific recurring tasks, reference these workflows:
- **[/analyze-unit](.agent/workflows/analyze-unit.md)**: How to analyze a unit's capabilities in Infinity
- **[/build-list](.agent/workflows/build-list.md)**: How to build an Infinity army list step-by-step
- **[/verify-rules](.agent/workflows/verify-rules.md)**: Protocol for verifying Infinity game rules before answering

## Application Quick Summary

**Infinity Data Explorer** is a purely client-side React web application for querying, exploring, and comparing unit data from the Infinity tabletop miniatures game. 

It relies on a modular windowed workspace UI and persistent Zustand global stores. All data is fetched statically from JSON files; there is no backend API.

**Tech Stack:**
- React 19 / TypeScript
- Vite
- Zustand
- Tailwind CSS v4
- Framer Motion
- Vitest / Playwright
