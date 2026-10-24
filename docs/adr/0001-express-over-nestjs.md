# Express over NestJS

The API is plain Express with TypeScript, composed through a `createApp()` factory and feature modules (routes, controller, service, schema). NestJS would add decorators, a DI container and module metadata that this scope does not need; explicit factory functions and dependency passing (the mailer, storage and summarizer are handed to the app) give the same testability with less framework to explain.

Consequence: wiring is manual, and consistency across modules is a convention rather than something the framework enforces.
