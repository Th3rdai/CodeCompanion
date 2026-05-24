# 💡 Self-Improvement Protocol (SIP.md) for CodeCompanion

***

(A set of professional development standards and best practices for maintaining and enhancing the CodeCompanion codebase and functionality.)

As we continue to develop the CodeCompanion app, our goal is not just to make it work, but to make it **robust, secure, and maintainable** for any developer to jump into. Drawing from our recent codebase reviews, this protocol outlines areas where proactive attention will elevate the product from "functional" to "industry-leading standard."

***

### 🔒 **Module 1: Security & Integrity Hardening (Priority: Critical)**

The biggest area of focus must be preventing external compromises from silently affecting our application.

**🎯 Improvement Focus: External Resource Integrity**
*   **The Principle:** Never trust a third-party resource without verifying its authenticity.
*   **Action Item (SRI Implementation):** All external scripts loaded from Content Delivery Networks (CDNs)—such as Tailwind CSS, React, Babel, or Markdown parsers—must include **Subresource Integrity (SRI) hashes**.
    *   **Why this matters:** Without an SRI hash, if a CDN is compromised, an attacker could inject malicious JavaScript into our application without us knowing. The SRI hash acts like a digital checksum, ensuring the downloaded file is exactly what we expect it to be.
    *   **🛠️ How to implement:** Add the `integrity="sha384-."` attribute to every external `<script>` tag.

**🎯 Improvement Focus: Input Sanitization**
*   **The Principle:** Never trust data coming from the outside (user input, APIs, or markdown files).
*   **Action Item (XSS Prevention):** When rendering user-generated content (especially from markdown parsing), we must pass the output through a dedicated sanitization library like **DOMPurify**.
    *   **Why this matters:** Even if the markdown parser works correctly, a malicious user might use markdown features to inject harmful HTML (XSS). Sanitization strips out all dangerous code, allowing us to render the content safely.

### 🐛 **Module 2: Reliability & Error Handling (Priority: High)**

An application must fail loudly and give the user a clear path to recovery, never silently failing in the background.

**🎯 Improvement Focus: Robust Network Failure Catching**
*   **The Principle:** Every asynchronous operation (like fetching settings or calling the backend) must handle potential failures.
*   **Action Item (Explicit Logging):** Eliminate empty `catch {}` blocks. Every failure must trigger a detailed log entry using `console.error(err)` or equivalent.
    *   **Why this matters:** Silent error catching (swallowing the error) makes debugging impossible. If the app fails to connect to Ollama or a backend service, we need to know *why* immediately.

**🎯 Improvement Focus: Syntactic Consistency**
*   **The Principle:** Adhere strictly to the syntax rules of the environment (HTML vs. JSX/React).
*   **Action Item (Attribute Naming):** Be mindful of context-specific attributes. In standard HTML, the class attribute is lowercase (`class`), whereas in React JSX, it is camelCase (`className`). Ensure the correct version is used based on the file's context to prevent styling failures.

### ✨ **Module 3: Architectural Excellence (Priority: Ongoing)**

These are the practices that keep the project clean, fast, and easy for new developers to work with.

**🎯 Improvement Focus: Progressive Modernization**
*   **The Principle:** Continual review of all dependencies and core APIs.
*   **Action Item (Upgrade/Audit):** Regular, scheduled runs of dependency audit tools (`npm audit fix`) are essential. Furthermore, whenever possible, we should migrate to modern standards (e.g., using `crypto.randomUUID()` instead of older UUID libraries).
*   **Pro-Tip (Refactoring):** Document every architectural decision. Creating a dedicated `README.md` or `DESIGN-STANDARDS.md` that explains *why* a feature was built a certain way helps the next developer solve the problem faster.