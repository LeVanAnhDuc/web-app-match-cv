// URL glob → RegExp with the semantics page.route() uses (Playwright ≥ 1.52): `**` matches anything including "/",
// `*` anything but "/", `{a,b}` alternation, every other character (including `?` and `[`) is literal. The whole URL
// must match, query string included. Lets a `page.on("request")` listener filter with the same pattern a route uses.

export type UrlMatcher = string | RegExp;

export function globToRegExp(glob: string): RegExp {
  let out = "^";
  let inGroup = false;
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (c === "{") {
      inGroup = true;
      out += "(?:";
    } else if (c === "}" && inGroup) {
      inGroup = false;
      out += ")";
    } else if (c === "," && inGroup) {
      out += "|";
    } else {
      out += c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    }
  }
  return new RegExp(`${out}$`);
}

export function urlMatches(matcher: UrlMatcher, url: string): boolean {
  if (matcher instanceof RegExp) {
    matcher.lastIndex = 0;
    return matcher.test(url);
  }
  return globToRegExp(matcher).test(url);
}
