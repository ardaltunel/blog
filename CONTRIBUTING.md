# Contributing to Blog

Thank you for your interest in contributing to **Blog**.

This project is a static blog platform built with HTML, CSS, JavaScript, and Supabase. Contributions that improve functionality, accessibility, security, documentation, performance, or user experience are welcome.

## Table of Contents

- [Before You Start](#before-you-start)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Contribution Workflow](#contribution-workflow)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Code Style](#code-style)
- [Supabase and Security Guidelines](#supabase-and-security-guidelines)
- [Testing Your Changes](#testing-your-changes)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Documentation Contributions](#documentation-contributions)
- [Review Process](#review-process)

## Before You Start

Before working on a contribution:

1. Check the existing issues and pull requests to avoid duplicate work.
2. For significant changes, open an issue first and explain the proposed solution.
3. Keep each pull request focused on one feature, fix, or improvement.
4. Never include private credentials, service-role keys, passwords, or personal data.

Small fixes such as typo corrections, minor accessibility improvements, and documentation updates may be submitted directly as a pull request.

## Ways to Contribute

You can contribute by:

- Fixing bugs
- Improving responsive behavior
- Improving accessibility
- Improving UI and user experience
- Optimizing performance
- Improving Supabase integration
- Improving authentication or authorization flows
- Improving database schemas and policies
- Adding or improving tests
- Improving documentation
- Reporting security concerns responsibly

## Development Setup

### 1. Fork the Repository

Fork the repository on GitHub, then clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/blog.git
cd blog
```

Add the original repository as an upstream remote:

```bash
git remote add upstream https://github.com/ardaltunel/blog.git
```

### 2. Configure Supabase

Create a Supabase project and run the SQL files in this order:

```text
database/supabase/schema.sql
database/supabase/seed.sql
```

Copy the Supabase project URL and anonymous public key into:

```text
assets/js/supabase-config.js
```

Example:

```js
window.SUPABASE_CONFIG = {
    url: 'https://YOUR_PROJECT_ID.supabase.co',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
    imageBasePath: './assets/images/',
    storageBucket: 'blog-images'
};
```

Use only a development Supabase project while contributing.

### 3. Start a Local Server

Use the bundled cache-safe development server while editing CSS or JavaScript:

```bash
npm run dev
```

You can also use another static development server. Using Python:

```bash
python -m http.server 4173
```

Using Node.js:

```bash
npx serve .
```

Using PHP:

```bash
php -S 127.0.0.1:4173 -t .
```

For the bundled server, open:

```text
http://127.0.0.1:5500/
```

Do not open the HTML files directly with the `file://` protocol, because browser security restrictions may prevent some features from working correctly.

## Project Structure

```text
.
├── assets/
│   ├── css/                 # Stylesheets
│   ├── data/                # Static data files
│   ├── favicon/             # Favicon files
│   ├── images/              # Static images
│   ├── js/                  # JavaScript modules and application logic
│   └── logo/                # Project logos
├── database/
│   └── supabase/
│       ├── schema.sql       # Database schema and policies
│       └── seed.sql         # Initial data
├── index.html               # Main blog page
├── admin.html               # Administrator dashboard
├── add-post.html            # Post creation page
├── signin.html              # Sign-in page
└── signup.html              # Registration page
```

Place new files in the most appropriate existing directory. Avoid creating new top-level directories unless they are necessary.

## Contribution Workflow

Synchronize your fork before starting:

```bash
git checkout main
git fetch upstream
git merge upstream/main
```

Create a new branch:

```bash
git checkout -b feature/short-description
```

Make your changes, test them locally, and commit them:

```bash
git add .
git commit -m "feat: add short description"
```

Push your branch:

```bash
git push origin feature/short-description
```

Then open a pull request against the `main` branch of `ardaltunel/blog`.

## Branch Naming

Use lowercase, descriptive branch names with hyphens.

Recommended prefixes:

```text
feature/
fix/
docs/
refactor/
style/
test/
chore/
```

Examples:

```text
feature/post-search
fix/mobile-navigation
docs/update-supabase-setup
refactor/authentication-flow
```

## Commit Messages

Use clear, concise commit messages. Conventional Commit-style prefixes are recommended:

```text
feat: add category filtering
fix: prevent duplicate post submissions
docs: clarify local setup steps
style: improve mobile spacing
refactor: simplify authentication checks
test: add validation test cases
chore: update repository configuration
```

Write commit messages in the imperative mood and keep the subject focused on the actual change.

Avoid vague messages such as:

```text
update
fix stuff
changes
final version
```

## Code Style

### HTML

- Use semantic HTML elements whenever possible.
- Include meaningful `alt` text for informative images.
- Associate labels with form inputs.
- Keep indentation consistent.
- Avoid unnecessary inline styles and scripts.
- Preserve keyboard accessibility.

### CSS

- Reuse existing variables, selectors, and layout patterns.
- Prefer responsive layouts over fixed dimensions.
- Avoid excessive selector specificity.
- Group related declarations together.
- Test changes on both mobile and desktop screen sizes.
- Do not introduce global styles that unintentionally affect unrelated pages.

### JavaScript

- Use `const` by default and `let` only when reassignment is required.
- Avoid `var`.
- Use clear and descriptive names.
- Keep functions focused on a single responsibility.
- Handle asynchronous operations with proper error handling.
- Validate user input before sending data to Supabase.
- Avoid exposing sensitive information in logs or error messages.
- Remove debugging statements before submitting a pull request.

Example:

```js
async function loadPublishedPosts() {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('is_approved', true);

        if (error) {
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Unable to load published posts:', error);
        return [];
    }
}
```

### SQL

- Format SQL statements consistently.
- Use descriptive table, column, policy, and function names.
- Document non-obvious policies or database functions.
- Keep Row Level Security enabled for exposed tables.
- Include migration or setup instructions when changing the schema.
- Update `seed.sql` when a schema change affects initial data.

## Supabase and Security Guidelines

Security-related contributions require extra care.

### Never Commit

Do not commit:

- Supabase `service_role` keys
- Database passwords
- Personal access tokens
- Private API keys
- Production-only environment values
- Real user data
- Session tokens or authentication cookies

The Supabase anonymous public key may be used in frontend applications, but all database access must still be protected by appropriate Row Level Security policies.

### Database Changes

When modifying the database:

1. Update `database/supabase/schema.sql`.
2. Update `database/supabase/seed.sql` when needed.
3. Review all affected Row Level Security policies.
4. Explain the schema change in the pull request.
5. Include manual verification steps.
6. Confirm that regular users cannot access administrator-only data or actions.

### Authentication and Authorization

Verify that:

- Unauthenticated users cannot access protected actions.
- Regular users cannot perform administrator actions.
- Users can only modify records they are authorized to manage.
- Administrator checks are enforced by database policies, not only by the user interface.
- Error messages do not reveal sensitive account information.

Please report serious security vulnerabilities privately rather than opening a public issue.

## Testing Your Changes

This project currently relies primarily on manual browser testing. Test every page and workflow affected by your change.

### General Checklist

- The application loads without console errors.
- Internal links and navigation work correctly.
- No broken images or missing assets are introduced.
- The layout works on desktop, tablet, and mobile widths.
- Forms provide understandable validation messages.
- Keyboard navigation remains usable.
- Existing features continue to work.

### Authentication Checklist

When authentication is affected, test:

- Registration
- Sign-in
- Sign-out
- Invalid credentials
- Unauthorized page access
- Session persistence
- Administrator and regular-user permissions

### Blog Checklist

When blog functionality is affected, test:

- Post listing
- Post creation
- Post editing, when applicable
- Category selection
- Thumbnail upload
- Static image fallback behavior
- Supabase Storage URLs
- Administrator approval workflows
- Empty and error states

### Database Checklist

When SQL files or policies are affected:

- Test the setup on a clean development Supabase project.
- Confirm that the schema runs without errors.
- Confirm that seed data is inserted successfully.
- Verify Row Level Security behavior for anonymous, authenticated, and administrator users.
- Confirm that existing data remains compatible.

Include the browsers and devices you tested in the pull request description.

## Submitting a Pull Request

Before opening a pull request:

- Rebase or merge the latest `main` branch into your branch.
- Review the complete diff.
- Remove unrelated changes.
- Remove debugging code.
- Confirm that no secrets or personal data are included.
- Test all affected functionality.
- Update documentation when behavior or setup changes.

A good pull request should include:

1. A clear title
2. A summary of the change
3. The reason for the change
4. Testing steps
5. Screenshots or recordings for visual changes
6. Related issue references
7. Notes about database or Supabase changes
8. Known limitations or follow-up work

Suggested pull request template:

```markdown
## Summary

Describe the change and why it is needed.

## Changes

- Change one
- Change two

## Testing

1. Start the local server.
2. Open the affected page.
3. Perform the relevant workflow.
4. Confirm the expected result.

## Screenshots

Add screenshots for visual changes.

## Supabase Changes

Describe schema, policy, storage, or authentication changes.

## Related Issue

Closes #ISSUE_NUMBER
```

Keep pull requests reasonably small. Large changes may be easier to review when split into multiple focused pull requests.

## Reporting Bugs

Before reporting a bug:

1. Check whether it has already been reported.
2. Reproduce it using the latest version of `main`.
3. Check the browser console and network panel for relevant errors.
4. Remove private data from screenshots and logs.

A useful bug report includes:

- A clear title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser and operating system
- Screen size or device, when relevant
- Console or network errors
- Screenshots or recordings
- Whether Supabase configuration or authentication is involved

## Suggesting Features

Feature requests should explain:

- The problem being solved
- Who benefits from the change
- The proposed behavior
- Possible alternatives
- UI or database impact
- Security or permission considerations
- Whether the change affects GitHub Pages compatibility

Focus on the user problem rather than only describing an implementation.

## Documentation Contributions

Documentation improvements are welcome.

When changing setup instructions:

- Verify every command.
- Use placeholder credentials rather than real values.
- Keep examples consistent with the repository structure.
- Update the README when the public setup process changes.
- Update this guide when the contribution process changes.

## Review Process

Maintainers may request changes related to:

- Functionality
- Security
- Accessibility
- Code quality
- Responsive design
- Database compatibility
- Documentation
- Scope of the pull request

A contribution may be closed when it:

- Duplicates existing work
- Introduces security risks
- Contains unrelated changes
- Breaks existing functionality
- Is inactive for an extended period
- Does not align with the project direction

Constructive feedback is part of the review process. Please keep discussions respectful, technical, and focused on improving the project.

Thank you for contributing to **Blog**.
