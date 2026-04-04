# lite-template

**High-Performance, Async-Safe JavaScript Template Engine.**

`lite-template` is a modern, ultra-lightweight template engine designed for the needs of today's asynchronous web applications. It serves as a drop-in replacement for the aging, sync-heavy legacy of **EJS**, while introducing native, first-class support for `async/await` throughout the entire template lifecycle.

## Technical Specifications

- **Runtime**: Node.js (v18+), Browser (Modern), Cloudflare Workers.
- **Language**: Core engine logic written in TypeScript.
- **Compiler**: Direct-to-string AsyncFunction compilation.
- **Distribution**: Native ESM (CommonJS not supported).

## The Architecture: Async-First Compilation

Most legacy engines (like `EJS`) were built in the pre-Promise era of Node.js. They execute template logic synchronously, which can block the event loop in high-throughput environments or when templates require database/API interaction.

`lite-tpl` compiles logic directly into native, V8-optimized **`AsyncFunction`** objects. This enables seamless, non-blocking template execution that leverages existing JavaScript primitives for maximum efficiency.

### Technical Limitations (Design Philosophy)

To prioritize performance and maintain its minimalist footprint (<10KB), `lite-template` purposefully omits several non-core EJS features:

1.  **Strictly Logic-Driven**: Unlike EJS, it does not include a complex built-in caching layer. Reusable templates should be pre-compiled using `compile()` at the application level.
2.  **Explicit Scope**: Uses the `with` block for performance. Variables must be defined within the provided `data` object to be accessible; it does not automatically pull from global scope.
3.  **Include System**: A native `include()` function works out-of-the-box (just like EJS) when `options.filename` is provided to `render()`, managing recursive resolution automatically. Does not implement `<%- layout() %>` systems.
4.  **No Middleware Integration**: This is a pure string-to-HTML engine—no native Express.js view-engine integration is included out of the box.
5.  **ESM Only**: Built exclusively for modern ESM toolchains.


*   **Async Native Engine**: Supports `await` natively within any `<% ... %>` or `<%= ... %>` block without messy workarounds.
*   **Optimal Performance**: Compiles template strings directly into optimized JavaScript function strings, skipping the AST-processing overhead of heavier engines.
*   **Predictable Scoping**: Leverages the JavaScript `with` scope for safe, predictable, and performant variable resolution.
*   **Micro Footprint**: Under 10KB. Eliminates the hundreds of cascading dependencies common in larger engines.
*   **Modern Compatibility**: Built for standard **EJS syntax** but engineered for the modern ES Module ecosystem.

## Installation

```bash
npm install lite-template
```

## Comparisons

| Feature | EJS | lite-template |
| :--- | :--- | :--- |
| **Logic** | Sync-First | **Async-Native** |
| **Parsing** | Bulky AST | **Direct-to-Function** |
| **Weight (approx)** | ~50KB | **<10KB** |
| **Dependencies** | Multiple (jake, async, etc.) | **Zero** |

## Quick Start

### Basic Rendering

```javascript
import { render } from 'lite-tpl';

const template = `<h2>Hello, <%= name %></h2>`;
const html = await render(template, { name: "System" });
```

### Advanced Loops and Logic

```javascript
const template = `
  <div class="user-list">
    <% users.forEach(user => { %>
      <div class="user-card"><%= user.name %></div>
    <% }); %>
  </div>
`;

const html = await render(template, {
  users: [{ name: "Alice" }, { name: "Bob" }]
});
```

### Native Built-in Includes

When you pass `filename` in the options, `lite-template` automatically exposes a built-in cross-file `include()` resolver.

```javascript
// page.ejs
// <h1>My Page</h1>
// <%- await include('footer', { text: "Copyright" }) %>

const html = await render(
  '<%- await include("footer") %>', 
  { globalVar: true }, 
  { filename: '/path/to/page.ejs' }
);
```

### First-Class Async/Await

```javascript
const template = `
  <div class="profile">
    <h2>User Details</h2>
    <p>Age: <%= await getUserAge(id) %></p>
  </div>
`;

const html = await render(template, {
  id: 101,
  getUserAge: async (id) => `Verified Age for User #${id}`
});
```

## API Reference

### `render(template, data)`

**Arguments:**
- `template` (string): The raw template string to compile and evaluate.
- `data` (object): The variable context to be accessible within the template.

**Returns:**
- `Promise<string>`: The final rendered output.

### `compile(template)`

**Arguments:**
- `template` (string): The raw template string.

**Returns:**
- `(data) => Promise<string>`: A reusable, high-performance async render function.

## License

MIT - Developed under the docmd ecosystem by [Ghazi](https://mgks.dev).