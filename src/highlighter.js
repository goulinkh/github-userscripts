import { tokenize as typescript } from '@twinkleplop/typescript';
import { tokenize as javascript } from '@twinkleplop/javascript';
const ts = typescript(), js = javascript();
const escape = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const roles = {
  comment:'comment', string:'string', template:'string', regex:'string', string_escape:'constant',
  number:'constant', boolean:'constant', constant:'constant', keyword:'keyword', operator:'keyword',
  function:'entity', type:'entity', class_name:'entity', decorator:'entity', namespace:'support',
  property:'variable', parameter:'variable'
};
const cache = new Map();
function highlight(code, language = '') {
  const lang = language.trim().toLowerCase();
  const tokenizer = ['ts','typescript'].includes(lang) ? ts : ['js','javascript','mjs','cjs'].includes(lang) ? js : null;
  if (!tokenizer || code.length > 50000) return escape(code);
  const key = lang + '\0' + code;
  if (cache.has(key)) return cache.get(key);
  try {
    const {tokens, token_types} = tokenizer(code);
    let html = '', cursor = 0;
    for (let i = 0; i < tokens.length; i += 3) {
      const start = tokens[i+1], end = tokens[i+2];
      if(start < cursor || end < start || end > code.length) return escape(code);
      html += escape(code.slice(cursor, start));
      const role = roles[token_types[tokens[i]]];
      const color = role ? `var(--codeMirror-syntax-fgColor-${role}, var(--fgColor-default))` : 'var(--fgColor-default)';
      html += `<span style="color:${color}">${escape(code.slice(start,end))}</span>`;
      cursor = end;
    }
    html += escape(code.slice(cursor));
    if(cache.size >= 32) cache.delete(cache.keys().next().value);
    cache.set(key,html);
    return html;
  } catch { return escape(code); }
}
window.__githubOverTypeHighlighter = {version:'twinkleplop-typescript-0.1.7', highlight};
