#!/usr/bin/env python3
"""Apply static first-party product CTAs. Safe to rerun after generating pages."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent.parent
BASE='https://margin.kickllm.com/'
STYLE='<link rel="stylesheet" href="/assets/margin-studio.css">'
MENU='<li><a class="margin-menu" href="https://margin.kickllm.com/?utm_source=kickllm&amp;utm_medium=navigation&amp;utm_campaign=margin_studio">Margin Studio <span aria-label="39 US dollars">$39</span></a></li>'

def offer(kind):
    if kind=='speed':
        title='Take the benchmark into your own workload.'
        copy='Review measured cost, acceptance and latency from your own trials. Use Margin Studio to compare the evidence, model contribution margins and export an explainable report.'
    else:
        title='Know your AI costs. Now plan your margin.'
        copy='Turn your usage CSV into a cost breakdown, test revenue and growth assumptions, and export a report for your next pricing decision. Margin Studio runs locally with rates you supply.'
    url=BASE+'?utm_source=kickllm&amp;utm_medium=contextual&amp;utm_campaign=margin_studio&amp;utm_content='+kind
    return f'''<!-- margin-studio-offer:start -->
<section class="margin-studio-cta" aria-label="KickLLM Margin Studio">
  <div><p class="margin-eyebrow">KickLLM Margin Studio · Offline analysis app</p>
    <h2>{title}</h2><p class="margin-copy">{copy}</p></div>
  <div class="margin-actions"><a class="margin-buy" href="{url}#buy">Get Margin Studio — $39</a>
    <a class="margin-preview" href="{url}#preview">Try the interactive preview →</a>
    <span class="margin-detail">One-time purchase · Downloadable ZIP</span></div>
</section>
<!-- margin-studio-offer:end -->'''

def transform(text,name):
    if 'http-equiv="refresh"' in text.lower() or '<body' not in text.lower(): return text
    if STYLE not in text:
        if '</head>' in text:text=text.replace('</head>',STYLE+'\n</head>',1)
        else:text=re.sub(r'(?=<body\b)',lambda _:STYLE+'\n</head>\n',text,count=1)
    if 'class="margin-menu"' not in text:
        if 'class="nav-links"' in text:
            text=re.sub(r'(<ul class="nav-links">[\s\S]*?)(</ul>)',lambda m:m[1]+'      '+MENU+'\n    '+m[2],text,count=1)
        else:
            nav='<nav class="margin-standalone-nav" aria-label="Main navigation"><a class="margin-home" href="/">kickllm / Free tools</a><a class="margin-menu" href="'+BASE+'?utm_source=kickllm&amp;utm_medium=navigation&amp;utm_campaign=margin_studio">Margin Studio · $39 →</a></nav>'
            text=re.sub(r'(<body[^>]*>)',lambda m:m[0]+'\n'+nav,text,count=1)
    if 'margin-studio-offer:start' not in text and name!='404.html':
        kind='speed' if any(s in name for s in ['latency','speed','throughput','tokens-per-second']) else 'cost'
        block=offer(kind)
        old=r'<script\b[^>]*\bdata-mt-cta\b[^>]*>\s*</script>'
        if re.search(old,text):text=re.sub(old,lambda _:block,text,count=1)
        elif re.search(r'<footer\b',text):text=re.sub(r'(?=<footer\b)',lambda _:block+'\n',text,count=1)
        else:text=text.replace('</body>',block+'\n</body>',1)
    if name=='index.html' and 'margin-hero-link' not in text:
        start=text.index('<section class="hero">');end=text.index('</section>',start)
        link='<a class="margin-hero-link" href="'+BASE+'?utm_source=kickllm&amp;utm_medium=homepage&amp;utm_campaign=margin_studio#preview">Working with real usage? Try Margin Studio · $39 once →</a>\n  '
        text=text[:end]+link+text[end:]
        # Put the full offer immediately after the calculator, where results lead to action.
        match=re.search(r'<!-- margin-studio-offer:start -->[\s\S]*?<!-- margin-studio-offer:end -->',text)
        if match:
            block=match[0];text=text[:match.start()]+text[match.end():]
            start=text.index('<section class="tool-section">');end=text.index('</section>',start)+len('</section>')
            text=text[:end]+'\n\n'+block+text[end:]
    return text

if __name__=='__main__':
    changed=0
    for p in ROOT.rglob('*.html'):
        if '.git' in p.parts:continue
        before=p.read_text();after=transform(before,p.relative_to(ROOT).as_posix())
        if before!=after:p.write_text(after);changed+=1
    print(f'Updated {changed} pages')
