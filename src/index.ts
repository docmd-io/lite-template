const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Compiles an EJS-style template string into an async function.
 * Supports: <% js %>, <%= escaped %>, <%- unescaped %>, <%# comment %>
 */
export function compile(template) {
  let code = "";
  const regex = /<%(=|-|_|#)?([\s\S]+?)([-_])?%>/g;
  let cursor = 0;
  let match;

  while ((match = regex.exec(template)) !== null) {
    const textBefore = template.slice(cursor, match.index);
    if (textBefore) {
      code += `__out += \`${textBefore.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`;\n`;
    }

    const type = match[1];
    let script = match[2].trim();

    if (type === '#') {
      // It's a comment, completely ignore it.
    } else if (type === '=') {
      // Escape HTML output
      code += `__out += escapeHtml(typeof (${script}) !== 'undefined' ? (${script}) : '');\n`;
    } else if (type === '-') {
      // Raw HTML output
      code += `__out += String(typeof (${script}) !== 'undefined' ? (${script}) : '');\n`;
    } else {
      // Literal JS code execution
      code += `${script}\n`;
    }
    cursor = match.index + match[0].length;
  }

  const textAfter = template.slice(cursor);
  if (textAfter) {
    code += `__out += \`${textAfter.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`;\n`;
  }

  const wrappedCode = `let __out = '';\nwith(__data || {}) {\n${code}\nreturn __out;\n}`;

  let fn;
  try {
    fn = new AsyncFunction("__data", "escapeHtml", wrappedCode);
  } catch (e) {
    console.error("COMPILATION ERROR CODE:\n" + wrappedCode.split('\n').map((l, i) => `${i+1}: ${l}`).join('\n'));
    throw e;
  }

  return function(data) {
    return fn(data, escapeHtml);
  };
}

/**
 * Built-in include function for file-based template inclusion.
 * Reads a file relative to the current template's location, compiles and renders it.
 * 
 * This provides the core EJS-compatible `include()` behavior:
 * - Resolves paths relative to the current template's `filename`
 * - Auto-appends `.ejs` extension if missing
 * - Recursively renders included templates
 * - Merges parent data with include-specific data
 * 
 * Consumers can override this by passing their own `include` function in `data`.
 * 
 * @param parentFilename - Absolute path of the template doing the including
 * @param parentData - Data context from the parent template
 * @param options - Render options (passed through to recursive render calls)
 */
async function builtinInclude(parentFilename: string | null, parentData: any, options: any, name: string, includeData: any = {}) {
  const extName = !name.endsWith('.ejs') ? name + '.ejs' : name;

  // Custom includer support (e.g. for virtual file systems or memory templates)
  if (options.includer) {
    const res = options.includer(extName, parentFilename);
    if (res && res.template) {
      const mergedData = { ...parentData, ...includeData };
      delete mergedData.include;
      return await render(res.template, mergedData, { ...options, filename: res.filename || parentFilename });
    }
  }

  // Lazy-load Node.js modules (keeps the package usable in non-Node environments at compile time)
  const { promises: fsPromises } = await import('node:fs');
  const path = await import('node:path');

  let targetPath: string;
  if (parentFilename) {
    targetPath = path.resolve(path.dirname(parentFilename), extName);
  } else {
    targetPath = path.resolve(extName);
  }

  let content = await fsPromises.readFile(targetPath, 'utf8');
  
  // Custom preprocessor hook before rendering (useful for stripping syntax outside of the engine's concern)
  if (options.preprocessor) {
    content = options.preprocessor(content, targetPath);
  }

  const mergedData = { ...parentData, ...includeData };

  // Remove the parent's include fn — render() will create a new one scoped to the new file
  delete mergedData.include;

  return await render(content, mergedData, { ...options, filename: targetPath });
}

/**
 * Renders an EJS-style template string with data.
 * 
 * Provides a built-in `include()` function when `options.filename` is set,
 * enabling file-based template inclusion just like EJS.
 * 
 * If the caller supplies their own `include` in `data`, it takes precedence
 * over the built-in version (allowing frameworks like docmd to extend behavior).
 * 
 * @param template - The EJS template string to render
 * @param data - Data object accessible inside the template via `with(data)`
 * @param options - Options: `filename` (path of this template, enables include resolution)
 * @returns The rendered string
 * 
 * @example
 * ```js
 * import tpl from 'lite-template';
 * 
 * // Simple render
 * const html = await tpl.render('<h1><%= title %></h1>', { title: 'Hello' });
 * 
 * // With file-based includes
 * const html = await tpl.render(
 *   '<%- include("header") %><p>Body</p>',
 *   { siteName: 'My Site' },
 *   { filename: '/path/to/current/template.ejs' }
 * );
 * ```
 */
export async function render(template, data = {}, options: any = {}) {
  const fn = compile(template);
  const filename = options.filename || (data as any).__filename || null;

  const enriched: any = {
    locals: data,
    ...data,
    __filename: filename
  };

  // Provide built-in include() if filename OR a virtual includer is set AND the caller hasn't provided their own
  if ((filename || options.includer) && !enriched.include) {
    enriched.include = (name: string, includeData: any = {}) =>
      builtinInclude(filename, enriched, options, name, includeData);
  }

  return await fn(enriched);
}

export default {
  render,
  compile
};