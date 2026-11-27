"""Prints the plain text of a Wikipedia article, for researching an issue's story.

Usage: python3 scripts/wiki.py en "Water puppetry" [max_chars]
"""
import json
import sys
import urllib.parse
import urllib.request

lang, title = sys.argv[1], sys.argv[2]
limit = int(sys.argv[3]) if len(sys.argv) > 3 else 20000
url = f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode(
    {"action": "query", "prop": "extracts", "explaintext": 1, "redirects": 1, "format": "json", "titles": title}
)
data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "vietwars-research"})))
for page in data["query"]["pages"].values():
    text = page.get("extract", "")
    print(f"## {page.get('title')} ({len(text)} characters)")
    print("\n".join(line for line in text[:limit].splitlines() if line.strip()))
