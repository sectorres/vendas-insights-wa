# AI Rules for NotifyHub Application

This document outlines the core technologies used in the NotifyHub application and provides guidelines for library usage to maintain consistency and best practices.

## Tech Stack Overview

*   **React**: A JavaScript library for building user interfaces.
*   **TypeScript**: A typed superset of JavaScript that compiles to plain JavaScript, enhancing code quality and maintainability.
*   **Vite**: A fast development build tool that provides a quick development server and optimized builds.
*   **Tailwind CSS**: A utility-first CSS framework for rapidly building custom designs.
*   **shadcn/ui**: A collection of reusable components built with Radix UI and styled with Tailwind CSS.
*   **React Router**: A standard library for routing in React applications.
*   **Supabase**: An open-source Firebase alternative providing a PostgreSQL database, authentication, and serverless functions.
*   **React Query**: A powerful library for managing, caching, and synchronizing server state in React applications.
*   **Zod**: A TypeScript-first schema declaration and validation library.
*   **Lucide React**: A collection of beautiful and customizable SVG icons.

## Library Usage Rules

To ensure consistency and maintainability, please adhere to the following guidelines when developing:

*   **UI Components**: Always prioritize `shadcn/ui` components for building the user interface. If a specific component is not available in `shadcn/ui`, use `Radix UI` primitives as a base and style them with Tailwind CSS. Avoid creating custom components from scratch if an existing library component can be adapted.
*   **Styling**: All styling must be done using `Tailwind CSS` classes. Avoid inline styles or separate CSS files for individual components.
*   **Routing**: Use `React Router` for all client-side navigation. All main application routes should be defined within `src/App.tsx`.
*   **State Management & Data Fetching**: `React Query` should be used for all server state management, data fetching, caching, and synchronization.
*   **Backend Interactions**: All backend operations, including database queries, authentication, and serverless function calls, must be handled via `Supabase`.
*   **Form Handling**: Use `react-hook-form` for managing form state and validation, paired with `Zod` for schema definition and validation.
*   **Icons**: Use icons from the `lucide-react` library.
*   **Notifications**: For transient, non-blocking notifications (e.g., "Item saved"), use `sonner`. For more persistent or action-oriented toasts (e.g., "Error fetching data, retry?"), use `shadcn/ui/toast`.