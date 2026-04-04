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
 * Supports: <% js %>, <%= escaped %>, <%- unescaped %>
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
    console.error("COMPILATION ERROR CODE:\n" + wrappedCode.split('\\n').map((l, i) => `${i+1}: ${l}`).join('\\n'));
    throw e;
  }

  return function(data) {
    return fn(data, escapeHtml);
  };
}

/**
 * Convenience method to render template directly.
 */
export async function render(template, data = {}, options = {}) {
  // Allow caching if 'filename' or 'id' is passed usually, but here we just compile and run.
  const fn = compile(template);
  // Add locals pseudo-property common in EJS contexts
  return await fn({ locals: data, ...data });
}

export default {
  render,
  compile
};
