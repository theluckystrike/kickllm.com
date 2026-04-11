#!/usr/bin/env node
// V31: Programmatic answer page generator for kickllm.com
// No npm dependencies — pure Node.js
'use strict';

const fs = require('fs');
const path = require('path');

const ANSWERS_DIR = path.join(__dirname, '..', 'answers');
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');
const TODAY = '2026-04-11';
const BASE_URL = 'https://kickllm.com';

// ─── Existing V30 pages — never overwrite ───────────────────────────────────
const PROTECTED = new Set([
  'cheapest-llm-api-2026.html',
  'cheapest-way-to-run-llama.html',
  'context-window-comparison-2026.html',
  'gpt4o-vs-claude-sonnet-price.html',
  'how-much-does-gpt4-cost-per-month.html',
  'llm-tokens-per-word.html',
  'when-to-self-host-llm.html',
]);

// ─── Model pricing data (April 2026) ────────────────────────────────────────
const MODELS = {
  'claude-opus-4': {
    name: 'Claude Opus 4', provider: 'Anthropic', input: 15, output: 75,
    context: '200K', speed: '30 tok/s', quality: 95,
    bestFor: 'complex reasoning, research, multi-step analysis',
    apiBase: 'https://api.anthropic.com/v1/messages',
    modelId: 'claude-opus-4-20260301',
  },
  'claude-sonnet-4': {
    name: 'Claude Sonnet 4', provider: 'Anthropic', input: 3, output: 15,
    context: '200K', speed: '80 tok/s', quality: 88,
    bestFor: 'coding, writing, balanced cost/quality workloads',
    apiBase: 'https://api.anthropic.com/v1/messages',
    modelId: 'claude-sonnet-4-20260301',
  },
  'claude-haiku-4': {
    name: 'Claude Haiku 4', provider: 'Anthropic', input: 0.80, output: 4,
    context: '200K', speed: '150 tok/s', quality: 78,
    bestFor: 'classification, extraction, high-volume tasks',
    apiBase: 'https://api.anthropic.com/v1/messages',
    modelId: 'claude-haiku-4-20260301',
  },
  'gpt-4o': {
    name: 'GPT-4o', provider: 'OpenAI', input: 2.50, output: 10,
    context: '128K', speed: '90 tok/s', quality: 90,
    bestFor: 'general-purpose, multimodal, tool use',
    apiBase: 'https://api.openai.com/v1/chat/completions',
    modelId: 'gpt-4o',
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini', provider: 'OpenAI', input: 0.15, output: 0.60,
    context: '128K', speed: '130 tok/s', quality: 75,
    bestFor: 'high-volume, budget tasks, fine-tuning base',
    apiBase: 'https://api.openai.com/v1/chat/completions',
    modelId: 'gpt-4o-mini',
  },
  'gemini-2-pro': {
    name: 'Gemini 2.0 Pro', provider: 'Google', input: 1.25, output: 5,
    context: '1M', speed: '100 tok/s', quality: 87,
    bestFor: 'long-context tasks, multimodal, Google ecosystem',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta/models',
    modelId: 'gemini-2.0-pro',
  },
  'gemini-2-flash': {
    name: 'Gemini 2.0 Flash', provider: 'Google', input: 0.075, output: 0.30,
    context: '1M', speed: '200 tok/s', quality: 73,
    bestFor: 'cheapest option for high-volume, long-context tasks',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta/models',
    modelId: 'gemini-2.0-flash',
  },
  'llama-3-405b': {
    name: 'Llama 3 405B', provider: 'Meta (open-source)', input: null, output: null,
    selfHostCost: '~$4/hr on 8xH100', context: '128K', speed: '25 tok/s', quality: 86,
    bestFor: 'privacy-first, custom fine-tuning, self-hosted deployments',
    apiBase: null,
    modelId: 'meta-llama/Meta-Llama-3-405B',
    apiProviders: [
      { name: 'Together.ai', input: 5, output: 15 },
      { name: 'Fireworks', input: 3, output: 9 },
      { name: 'Groq', input: null, output: null, note: 'waitlist' },
    ],
  },
  'mistral-large': {
    name: 'Mistral Large', provider: 'Mistral', input: 2, output: 6,
    context: '128K', speed: '70 tok/s', quality: 84,
    bestFor: 'European data residency, multilingual, coding',
    apiBase: 'https://api.mistral.ai/v1/chat/completions',
    modelId: 'mistral-large-latest',
  },
  'deepseek-v3': {
    name: 'DeepSeek V3', provider: 'DeepSeek', input: 0.27, output: 1.10,
    context: '128K', speed: '60 tok/s', quality: 82,
    bestFor: 'budget reasoning, coding, math-heavy tasks',
    apiBase: 'https://api.deepseek.com/chat/completions',
    modelId: 'deepseek-chat',
  },
};

// ─── Helper functions ────────────────────────────────────────────────────────

function fmt(n) {
  if (n === null || n === undefined) return 'N/A';
  if (n < 0.01) return '$' + n.toFixed(4);
  if (n < 1) return '$' + n.toFixed(2);
  return '$' + n.toFixed(2);
}

function costCalc(inputTokens, outputTokens, inputPrice, outputPrice) {
  if (inputPrice === null) return 'varies';
  const cost = (inputTokens / 1e6) * inputPrice + (outputTokens / 1e6) * outputPrice;
  if (cost < 0.001) return '<$0.001';
  if (cost < 0.01) return '$' + cost.toFixed(4);
  return '$' + cost.toFixed(4);
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugToTitle(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Common HTML fragments ──────────────────────────────────────────────────

function head(title, desc, canonical, faqSchema) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>${escHtml(title)} — KickLLM</title>
  <meta name="description" content="${escHtml(desc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" type="application/atom+xml" title="KickLLM Blog Feed" href="/blog/feed.xml">
  <meta property="og:title" content="${escHtml(title)} — KickLLM">
  <meta property="og:description" content="${escHtml(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:image" content="https://kickllm.com/assets/og-image.png">
  <meta property="og:site_name" content="Zovo Tools">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escHtml(title)} — KickLLM">
  <meta name="twitter:description" content="${escHtml(desc)}">
  <meta name="twitter:image" content="https://kickllm.com/assets/og-image.png">
  <script type="application/ld+json">
  ${JSON.stringify(faqSchema, null, 2)}
  </script>
  <link rel="stylesheet" href="/assets/style.css">
</head>`;
}

function nav() {
  return `<body>
  <nav class="nav">
    <a href="/" class="nav-logo">kickllm</a>
    <ul class="nav-links">
      <li><a href="/">Calculator</a></li>
      <li><a href="/research/llm-value-index-2026.html">Research</a></li>
      <li><a href="/blog/">Blog</a></li>
      <li><a href="/about.html">About</a></li>
    </ul>
    <div class="nav-right">
      <a href="https://zovo.one/pricing?utm_source=kickllm.com&amp;utm_medium=satellite&amp;utm_campaign=nav-link" class="nav-pro" target="_blank">Go Pro &#10022;</a>
      <a href="https://zovo.one/tools" class="nav-zovo">Zovo Tools</a>
    </div>
  </nav>`;
}

function breadcrumb(title) {
  return `
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <div class="container">
      <a href="/">Home</a> &rsaquo; <a href="/answers/">Answers</a> &rsaquo; <span>${escHtml(title)}</span>
    </div>
  </nav>`;
}

function footer() {
  return `
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">Zovo Tools</div>
      <div class="footer-tagline">Free developer tools by a solo dev. No tracking.</div>
      <a href="https://zovo.one/pricing?utm_source=kickllm.com&amp;utm_medium=satellite&amp;utm_campaign=footer-link" class="footer-cta">Zovo Lifetime — $99 once, free forever &rarr;</a>
      <div class="footer-copy">&copy; 2026 <a href="https://zovo.one">Zovo</a> &middot; 47/500 founding spots</div>
    </div>
  </footer>

  <nav class="zovo-network" aria-label="Zovo Tools Network">
    <div class="zovo-network-inner">
      <h3 class="zovo-network-title">Explore More Tools</h3>
      <div class="zovo-network-links">
        <a href="https://abwex.com">ABWex — A/B Testing</a>
        <a href="https://claudflow.com">ClaudFlow — Workflows</a>
        <a href="https://claudhq.com">ClaudHQ — Prompts</a>
        <a href="https://claudkit.com">ClaudKit — API</a>
        <a href="https://enhio.com">Enhio — Text Tools</a>
        <a href="https://epochpilot.com">EpochPilot — Timestamps</a>
        <a href="https://gen8x.com">Gen8X — Color Tools</a>
        <a href="https://gpt0x.com">GPT0X — AI Models</a>
        <a href="https://heytensor.com">HeyTensor — ML Tools</a>
        <a href="https://invokebot.com">InvokeBot — Webhooks</a>
        <a href="https://kappafy.com">Kappafy — JSON</a>
        <a href="https://kappakit.com">KappaKit — Dev Toolkit</a>
        <a href="https://krzen.com">Krzen — Image Tools</a>
        <a href="https://lochbot.com">LochBot — Security</a>
        <a href="https://lockml.com">LockML — ML Compare</a>
        <a href="https://ml3x.com">ML3X — Matrix Math</a>
      </div>
    </div>
  </nav>
</body>
</html>`;
}

function relatedLinks(exclude) {
  const allLinks = [
    { href: '/answers/cheapest-llm-api-2026.html', text: 'Cheapest LLM API in 2026' },
    { href: '/answers/claude-opus-4-pricing.html', text: 'Claude Opus 4 Pricing' },
    { href: '/answers/claude-sonnet-4-pricing.html', text: 'Claude Sonnet 4 Pricing' },
    { href: '/answers/gpt-4o-pricing.html', text: 'GPT-4o Pricing Breakdown' },
    { href: '/answers/gemini-2-flash-pricing.html', text: 'Gemini 2.0 Flash Pricing' },
    { href: '/answers/deepseek-v3-pricing.html', text: 'DeepSeek V3 Pricing' },
    { href: '/answers/claude-opus-vs-gpt-4o.html', text: 'Claude Opus 4 vs GPT-4o' },
    { href: '/answers/claude-haiku-vs-gpt-4o-mini.html', text: 'Claude Haiku vs GPT-4o Mini' },
    { href: '/answers/cost-of-llm-chatbot-per-month.html', text: 'Cost of LLM Chatbot Per Month' },
    { href: '/answers/cost-of-rag-pipeline.html', text: 'Cost of a RAG Pipeline' },
    { href: '/answers/llm-api-cost-optimization-tips.html', text: 'LLM API Cost Optimization Tips' },
    { href: '/answers/gpt4o-vs-claude-sonnet-price.html', text: 'GPT-4o vs Claude Sonnet Price' },
    { href: '/answers/how-much-does-gpt4-cost-per-month.html', text: 'How Much Does GPT-4 Cost Per Month?' },
    { href: '/answers/when-to-self-host-llm.html', text: 'When to Self-Host an LLM' },
  ];
  const filtered = allLinks.filter(l => !exclude.some(e => l.href.includes(e)));
  const picked = filtered.slice(0, 5);
  return `
    <h2>Related Questions</h2>
    <ul>
${picked.map(l => `      <li><a href="${l.href}">${l.text}</a></li>`).join('\n')}
    </ul>`;
}

function faqSchema(questions) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(q => ({
      '@type': 'Question',
      name: q.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.a,
      },
    })),
  };
}

function disclaimer() {
  return `\n    <p style="margin-top:2rem; font-size:0.9em; color:#666;"><em>Prices last verified: April 2026. Pricing may change — always check provider websites for current rates.</em></p>`;
}

function calcCta() {
  return `\n    <p style="margin-top:2rem;"><a href="/">Calculate your LLM API costs with KickLLM</a> &mdash; free, no sign-up required.</p>`;
}

// ─── Get top N alternatives for a model ──────────────────────────────────────

function getAlternatives(modelKey, n = 3) {
  const allKeys = Object.keys(MODELS).filter(k => k !== modelKey);
  // Sort by quality similarity then price
  const m = MODELS[modelKey];
  allKeys.sort((a, b) => {
    const da = Math.abs(MODELS[a].quality - m.quality);
    const db = Math.abs(MODELS[b].quality - m.quality);
    return da - db;
  });
  return allKeys.slice(0, n);
}

// ─── Pattern A: Model-Specific Pricing Pages ────────────────────────────────

function generateModelPage(key) {
  const m = MODELS[key];
  const slug = key;
  const filename = `${slug}-pricing.html`;
  const title = `${m.name} Pricing — API Cost Breakdown (April 2026)`;
  const isOpenSource = m.input === null;

  const inputStr = isOpenSource ? 'Self-host' : fmt(m.input);
  const outputStr = isOpenSource ? 'Self-host' : fmt(m.output);

  // Cost calculations for common tasks
  const pageSummary = isOpenSource ? 'varies by provider' : costCalc(800, 400, m.input, m.output);
  const conversation10k = isOpenSource ? 'varies by provider' : costCalc(8000, 2000, m.input, m.output);
  const batch1000 = isOpenSource ? 'varies by provider' : costCalc(500000, 500000, m.input, m.output);

  // Monthly estimates
  let lightMonthly, medMonthly, heavyMonthly;
  if (!isOpenSource) {
    lightMonthly = fmt((50000 / 1e6) * m.input * 30 + (25000 / 1e6) * m.output * 30);
    medMonthly = fmt((500000 / 1e6) * m.input * 30 + (250000 / 1e6) * m.output * 30);
    heavyMonthly = fmt((5000000 / 1e6) * m.input * 30 + (2500000 / 1e6) * m.output * 30);
  } else {
    lightMonthly = '~$100/mo (shared GPU)';
    medMonthly = '~$2,880/mo (1x H100)';
    heavyMonthly = '~$23,000/mo (8x H100)';
  }

  const desc = isOpenSource
    ? `${m.name} pricing: self-host at ${m.selfHostCost} or use API providers. Context window: ${m.context}. Best for ${m.bestFor}.`
    : `${m.name} pricing: ${inputStr}/${outputStr} per 1M tokens (input/output). Context window: ${m.context}. Best for ${m.bestFor}.`;

  const alts = getAlternatives(key, 3);

  const faqs = [
    {
      q: `How much does ${m.name} cost per API call?`,
      a: isOpenSource
        ? `${m.name} is open-source and free to download. API access via providers like Together.ai costs approximately $3-$15 per 1M tokens. Self-hosting on 8xH100 costs ${m.selfHostCost}.`
        : `A typical ${m.name} API call with 1K input and 500 output tokens costs approximately ${costCalc(1000, 500, m.input, m.output)}. Pricing is ${inputStr} per 1M input tokens and ${outputStr} per 1M output tokens.`,
    },
    {
      q: `Is ${m.name} worth the price?`,
      a: `${m.name} scores approximately ${m.quality}/100 on aggregate benchmarks. It is best suited for ${m.bestFor}. ${isOpenSource ? 'As an open-source model, you can self-host for full data privacy.' : `At ${inputStr}/${outputStr} per 1M tokens, it offers competitive value for its quality tier.`}`,
    },
    {
      q: `What are cheaper alternatives to ${m.name}?`,
      a: `Top alternatives: ${alts.map(a => {
        const am = MODELS[a];
        return am.input !== null ? `${am.name} at ${fmt(am.input)}/${fmt(am.output)}` : `${am.name} (self-hosted)`;
      }).join(', ')}. Use KickLLM's calculator to compare costs for your specific workload.`,
    },
  ];

  // Code example
  let codeExample;
  if (key.startsWith('claude')) {
    codeExample = `
    <h2>API Code Example with Cost Calculation</h2>
    <pre><code>import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="${m.modelId}",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Summarize this document..."}]
)

# Cost calculation
input_tokens = response.usage.input_tokens
output_tokens = response.usage.output_tokens
cost = (input_tokens / 1_000_000) * ${m.input} + (output_tokens / 1_000_000) * ${m.output}
print(f"Tokens: {input_tokens} in / {output_tokens} out")
print(f"Cost: ${'{cost:.6f}'}")
# Typical 1-page summary: ~${pageSummary}</code></pre>`;
  } else if (key.startsWith('gpt')) {
    codeExample = `
    <h2>API Code Example with Cost Calculation</h2>
    <pre><code>from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="${m.modelId}",
    messages=[{"role": "user", "content": "Summarize this document..."}],
    max_tokens=1024
)

# Cost calculation
usage = response.usage
cost = (usage.prompt_tokens / 1_000_000) * ${m.input} + (usage.completion_tokens / 1_000_000) * ${m.output}
print(f"Tokens: {usage.prompt_tokens} in / {usage.completion_tokens} out")
print(f"Cost: ${'{cost:.6f}'}")
# Typical 1-page summary: ~${pageSummary}</code></pre>`;
  } else if (key.startsWith('gemini')) {
    codeExample = `
    <h2>API Code Example with Cost Calculation</h2>
    <pre><code>import google.generativeai as genai

model = genai.GenerativeModel("${m.modelId}")
response = model.generate_content("Summarize this document...")

# Cost calculation
usage = response.usage_metadata
input_tokens = usage.prompt_token_count
output_tokens = usage.candidates_token_count
cost = (input_tokens / 1_000_000) * ${m.input} + (output_tokens / 1_000_000) * ${m.output}
print(f"Tokens: {input_tokens} in / {output_tokens} out")
print(f"Cost: ${'{cost:.6f}'}")
# Typical 1-page summary: ~${pageSummary}</code></pre>`;
  } else if (key === 'llama-3-405b') {
    codeExample = `
    <h2>API Code Example (via Together.ai)</h2>
    <pre><code>from openai import OpenAI

# Together.ai provides OpenAI-compatible API
client = OpenAI(
    base_url="https://api.together.xyz/v1",
    api_key="your-together-api-key"
)

response = client.chat.completions.create(
    model="${m.modelId}",
    messages=[{"role": "user", "content": "Summarize this document..."}],
    max_tokens=1024
)

# Cost via Together.ai: ~$5/$15 per 1M tokens
# Self-host on 8xH100: ${m.selfHostCost} (no per-token cost)
usage = response.usage
cost = (usage.prompt_tokens / 1_000_000) * 5 + (usage.completion_tokens / 1_000_000) * 15
print(f"Cost via Together.ai: ${'{cost:.6f}'}")</code></pre>`;
  } else if (key === 'mistral-large') {
    codeExample = `
    <h2>API Code Example with Cost Calculation</h2>
    <pre><code>from mistralai import Mistral

client = Mistral(api_key="your-api-key")

response = client.chat.complete(
    model="${m.modelId}",
    messages=[{"role": "user", "content": "Summarize this document..."}]
)

# Cost calculation
usage = response.usage
cost = (usage.prompt_tokens / 1_000_000) * ${m.input} + (usage.completion_tokens / 1_000_000) * ${m.output}
print(f"Tokens: {usage.prompt_tokens} in / {usage.completion_tokens} out")
print(f"Cost: ${'{cost:.6f}'}")
# Typical 1-page summary: ~${pageSummary}</code></pre>`;
  } else if (key === 'deepseek-v3') {
    codeExample = `
    <h2>API Code Example with Cost Calculation</h2>
    <pre><code>from openai import OpenAI

# DeepSeek uses OpenAI-compatible API
client = OpenAI(
    base_url="https://api.deepseek.com",
    api_key="your-deepseek-api-key"
)

response = client.chat.completions.create(
    model="${m.modelId}",
    messages=[{"role": "user", "content": "Summarize this document..."}],
    max_tokens=1024
)

# Cost calculation
usage = response.usage
cost = (usage.prompt_tokens / 1_000_000) * ${m.input} + (usage.completion_tokens / 1_000_000) * ${m.output}
print(f"Tokens: {usage.prompt_tokens} in / {usage.completion_tokens} out")
print(f"Cost: ${'{cost:.6f}'}")
# Typical 1-page summary: ~${pageSummary}</code></pre>`;
  }

  // Comparison table vs alternatives
  let comparisonTable = `
    <h2>${m.name} vs Alternatives</h2>
    <table>
      <thead>
        <tr><th>Model</th><th>Input (per 1M)</th><th>Output (per 1M)</th><th>Context</th><th>Speed</th><th>Quality</th></tr>
      </thead>
      <tbody>
        <tr style="background:#f0f7ff;"><td><strong>${m.name}</strong></td><td>${isOpenSource ? 'Self-host' : inputStr}</td><td>${isOpenSource ? 'Self-host' : outputStr}</td><td>${m.context}</td><td>${m.speed}</td><td>${m.quality}/100</td></tr>`;
  for (const ak of alts) {
    const am = MODELS[ak];
    const aInput = am.input !== null ? fmt(am.input) : 'Self-host';
    const aOutput = am.output !== null ? fmt(am.output) : 'Self-host';
    comparisonTable += `
        <tr><td>${am.name}</td><td>${aInput}</td><td>${aOutput}</td><td>${am.context}</td><td>${am.speed}</td><td>${am.quality}/100</td></tr>`;
  }
  comparisonTable += `
      </tbody>
    </table>`;

  // Self-host specific section
  let selfHostSection = '';
  if (isOpenSource) {
    selfHostSection = `
    <h2>Self-Hosting Costs</h2>
    <table>
      <thead>
        <tr><th>Setup</th><th>Hardware</th><th>Monthly Cost</th><th>Best For</th></tr>
      </thead>
      <tbody>
        <tr><td>Cloud GPU (8xH100)</td><td>8x NVIDIA H100 80GB</td><td>~$23,000/mo</td><td>Production workloads</td></tr>
        <tr><td>Cloud GPU (8xA100)</td><td>8x NVIDIA A100 80GB</td><td>~$15,000/mo</td><td>Cost-optimized production</td></tr>
        <tr><td>On-demand spot</td><td>Spot 8xH100</td><td>~$8,000/mo</td><td>Batch processing</td></tr>
      </tbody>
    </table>

    <h2>API Provider Pricing</h2>
    <table>
      <thead>
        <tr><th>Provider</th><th>Input (per 1M)</th><th>Output (per 1M)</th><th>Notes</th></tr>
      </thead>
      <tbody>
${m.apiProviders.map(p => `        <tr><td>${p.name}</td><td>${p.input !== null ? fmt(p.input) : 'N/A'}</td><td>${p.output !== null ? fmt(p.output) : 'N/A'}</td><td>${p.note || 'Available now'}</td></tr>`).join('\n')}
      </tbody>
    </table>`;
  }

  // Monthly cost estimates
  let monthlySection;
  if (!isOpenSource) {
    monthlySection = `
    <h2>Monthly Cost Estimates</h2>
    <table>
      <thead>
        <tr><th>Usage Level</th><th>Daily Tokens (in/out)</th><th>Monthly Cost</th></tr>
      </thead>
      <tbody>
        <tr><td>Light (personal project)</td><td>50K / 25K</td><td>${lightMonthly}</td></tr>
        <tr><td>Medium (small SaaS)</td><td>500K / 250K</td><td>${medMonthly}</td></tr>
        <tr><td>Heavy (production app)</td><td>5M / 2.5M</td><td>${heavyMonthly}</td></tr>
      </tbody>
    </table>`;
  } else {
    monthlySection = `
    <h2>Monthly Cost Estimates</h2>
    <table>
      <thead>
        <tr><th>Usage Level</th><th>Setup</th><th>Monthly Cost</th></tr>
      </thead>
      <tbody>
        <tr><td>Light (testing/dev)</td><td>Shared GPU or API provider</td><td>${lightMonthly}</td></tr>
        <tr><td>Medium (production)</td><td>Dedicated 1x H100</td><td>${medMonthly}</td></tr>
        <tr><td>Heavy (enterprise)</td><td>8x H100 cluster</td><td>${heavyMonthly}</td></tr>
      </tbody>
    </table>`;
  }

  const commonTasks = !isOpenSource ? `
    <h2>Cost for Common Tasks</h2>
    <table>
      <thead>
        <tr><th>Task</th><th>Input Tokens</th><th>Output Tokens</th><th>Cost</th></tr>
      </thead>
      <tbody>
        <tr><td>1-page summary</td><td>~800</td><td>~400</td><td>${pageSummary}</td></tr>
        <tr><td>10K token conversation</td><td>~8,000</td><td>~2,000</td><td>${conversation10k}</td></tr>
        <tr><td>Batch of 1,000 API calls</td><td>~500K</td><td>~500K</td><td>${batch1000}</td></tr>
      </tbody>
    </table>` : '';

  const bestUseCases = `
    <h2>When to Use ${m.name}</h2>
    <ul>
      <li><strong>Best for:</strong> ${m.bestFor}</li>
      <li><strong>Context window:</strong> ${m.context} tokens — ${parseInt(m.context) >= 200 ? 'suitable for long documents, entire codebases' : 'handles most documents and conversations'}</li>
      <li><strong>Speed:</strong> ${m.speed} — ${parseInt(m.speed) > 100 ? 'fast enough for real-time chat' : parseInt(m.speed) > 50 ? 'good for interactive use' : 'better for batch/async tasks'}</li>
      <li><strong>Quality:</strong> ${m.quality}/100 — ${m.quality >= 90 ? 'top-tier, frontier-class' : m.quality >= 80 ? 'strong, suitable for most tasks' : 'good for straightforward tasks'}</li>
    </ul>`;

  const canonical = `${BASE_URL}/answers/${filename}`;

  let html = head(title, desc, canonical, faqSchema(faqs));
  html += '\n' + nav();
  html += breadcrumb(`${m.name} Pricing`);
  html += `\n\n  <div class="page-content">
    <h1>${m.name} Pricing — API Cost Breakdown</h1>

    <p><strong>${desc}</strong></p>

    <h2>Pricing Overview</h2>
    <table>
      <thead>
        <tr><th>Metric</th><th>Value</th></tr>
      </thead>
      <tbody>
        <tr><td>Input price (per 1M tokens)</td><td>${isOpenSource ? 'Free (self-hosted) / varies by API provider' : inputStr}</td></tr>
        <tr><td>Output price (per 1M tokens)</td><td>${isOpenSource ? 'Free (self-hosted) / varies by API provider' : outputStr}</td></tr>
        <tr><td>Context window</td><td>${m.context} tokens</td></tr>
        <tr><td>Speed (typical)</td><td>${m.speed}</td></tr>
        <tr><td>Provider</td><td>${m.provider}</td></tr>
      </tbody>
    </table>`;

  html += commonTasks;
  html += selfHostSection;
  html += comparisonTable;
  html += bestUseCases;
  html += codeExample;
  html += monthlySection;

  html += `

    <h2>FAQ</h2>`;
  for (const faq of faqs) {
    html += `
    <h3>${escHtml(faq.q)}</h3>
    <p>${escHtml(faq.a)}</p>`;
  }

  html += relatedLinks([filename]);
  html += disclaimer();
  html += calcCta();
  html += '\n  </div>';
  html += footer();

  return { filename, html, title };
}

// ─── Pattern B: Head-to-Head Comparison Pages ───────────────────────────────

const COMPARISONS = [
  {
    slug: 'claude-opus-vs-gpt-4o',
    modelA: 'claude-opus-4', modelB: 'gpt-4o',
    title: 'Claude Opus 4 vs GPT-4o — Pricing, Quality & Speed Compared',
    subtitle: 'Premium model showdown: Anthropic\'s flagship vs OpenAI\'s flagship',
  },
  {
    slug: 'claude-haiku-vs-gpt-4o-mini',
    modelA: 'claude-haiku-4', modelB: 'gpt-4o-mini',
    title: 'Claude Haiku 4 vs GPT-4o Mini — Budget Model Comparison',
    subtitle: 'Budget model showdown: cheapest Anthropic vs cheapest OpenAI',
  },
  {
    slug: 'gemini-flash-vs-gpt-4o-mini',
    modelA: 'gemini-2-flash', modelB: 'gpt-4o-mini',
    title: 'Gemini 2.0 Flash vs GPT-4o Mini — Cheapest Model Comparison',
    subtitle: 'The two cheapest major-provider models head-to-head',
  },
  {
    slug: 'claude-sonnet-vs-gemini-pro',
    modelA: 'claude-sonnet-4', modelB: 'gemini-2-pro',
    title: 'Claude Sonnet 4 vs Gemini 2.0 Pro — Mid-Tier Comparison',
    subtitle: 'Mid-tier balance: Anthropic\'s workhorse vs Google\'s flagship',
  },
  {
    slug: 'llama-3-vs-gpt-4o',
    modelA: 'llama-3-405b', modelB: 'gpt-4o',
    title: 'Llama 3 405B vs GPT-4o — Open Source vs Proprietary',
    subtitle: 'Open-source freedom vs proprietary convenience',
  },
  {
    slug: 'mistral-vs-claude-sonnet',
    modelA: 'mistral-large', modelB: 'claude-sonnet-4',
    title: 'Mistral Large vs Claude Sonnet 4 — European vs American AI',
    subtitle: 'EU data residency vs Anthropic\'s safety-focused model',
  },
  {
    slug: 'deepseek-vs-gpt-4o-mini',
    modelA: 'deepseek-v3', modelB: 'gpt-4o-mini',
    title: 'DeepSeek V3 vs GPT-4o Mini — Budget API Comparison',
    subtitle: 'China\'s budget champion vs OpenAI\'s smallest model',
  },
  {
    slug: 'open-source-vs-api-models-2026',
    modelA: 'llama-3-405b', modelB: 'gpt-4o',
    title: 'Open-Source vs API Models in 2026 — Comprehensive Comparison',
    subtitle: 'When to self-host open-source models vs using commercial APIs',
    isComprehensive: true,
  },
];

function generateComparisonPage(comp) {
  const a = MODELS[comp.modelA];
  const b = MODELS[comp.modelB];
  const filename = `${comp.slug}.html`;

  const aInput = a.input !== null ? fmt(a.input) : 'Self-host';
  const aOutput = a.output !== null ? fmt(a.output) : 'Self-host';
  const bInput = b.input !== null ? fmt(b.input) : 'Self-host';
  const bOutput = b.output !== null ? fmt(b.output) : 'Self-host';

  const desc = `${a.name} vs ${b.name}: compare pricing (${aInput} vs ${bInput} input), quality scores, speed, and context windows. Find which model is best for your use case.`;

  // Determine verdicts
  const pricingVerdict = (() => {
    if (a.input === null || b.input === null) return 'Self-hosted models have no per-token cost but require GPU infrastructure.';
    if (a.input < b.input && a.output < b.output) return `${a.name} is cheaper on both input and output.`;
    if (b.input < a.input && b.output < a.output) return `${b.name} is cheaper on both input and output.`;
    return `Mixed: ${a.input < b.input ? a.name : b.name} is cheaper on input, ${a.output < b.output ? a.name : b.name} is cheaper on output.`;
  })();

  const qualityVerdict = a.quality > b.quality
    ? `${a.name} scores higher (${a.quality} vs ${b.quality}/100).`
    : a.quality < b.quality
    ? `${b.name} scores higher (${b.quality} vs ${a.quality}/100).`
    : `Both score similarly (${a.quality}/100).`;

  const speedVerdict = parseInt(a.speed) > parseInt(b.speed)
    ? `${a.name} is faster at ${a.speed} vs ${b.speed}.`
    : parseInt(a.speed) < parseInt(b.speed)
    ? `${b.name} is faster at ${b.speed} vs ${a.speed}.`
    : 'Both have similar speeds.';

  // Overall verdict
  let overallVerdict;
  if (a.input !== null && b.input !== null) {
    const aValueScore = a.quality / ((a.input + a.output) / 2);
    const bValueScore = b.quality / ((b.input + b.output) / 2);
    if (aValueScore > bValueScore * 1.1) {
      overallVerdict = `<strong>Pick ${a.name}</strong> if you want better value (quality per dollar). <strong>Pick ${b.name}</strong> if ${b.quality > a.quality ? 'you need peak quality' : b.input < a.input ? 'you need the lowest cost' : 'you prefer the ' + b.provider + ' ecosystem'}.`;
    } else if (bValueScore > aValueScore * 1.1) {
      overallVerdict = `<strong>Pick ${b.name}</strong> if you want better value (quality per dollar). <strong>Pick ${a.name}</strong> if ${a.quality > b.quality ? 'you need peak quality' : a.input < b.input ? 'you need the lowest cost' : 'you prefer the ' + a.provider + ' ecosystem'}.`;
    } else {
      overallVerdict = `Both models offer competitive value. <strong>Pick ${a.name}</strong> for ${a.bestFor.split(',')[0]}. <strong>Pick ${b.name}</strong> for ${b.bestFor.split(',')[0]}.`;
    }
  } else {
    overallVerdict = `<strong>Pick ${a.name}</strong> for full data control and no per-token costs. <strong>Pick ${b.name}</strong> for zero infrastructure overhead and instant scaling.`;
  }

  const faqs = [
    {
      q: `Is ${a.name} better than ${b.name}?`,
      a: `${a.name} scores ${a.quality}/100 vs ${b.name} at ${b.quality}/100. ${a.name} is best for ${a.bestFor}. ${b.name} is best for ${b.bestFor}. The right choice depends on your use case and budget.`,
    },
    {
      q: `Which is cheaper, ${a.name} or ${b.name}?`,
      a: pricingVerdict,
    },
    {
      q: `Can I switch between ${a.name} and ${b.name}?`,
      a: `Yes. Both models support standard chat completion APIs. You can use model routing to send simple queries to the cheaper model and complex queries to the more capable one, optimizing your costs.`,
    },
  ];

  // Comprehensive comparison extras
  let comprehensiveSection = '';
  if (comp.isComprehensive) {
    comprehensiveSection = `
    <h2>Full Model Landscape (April 2026)</h2>
    <table>
      <thead>
        <tr><th>Model</th><th>Type</th><th>Input (per 1M)</th><th>Output (per 1M)</th><th>Quality</th></tr>
      </thead>
      <tbody>
${Object.entries(MODELS).map(([k, m]) => `        <tr><td>${m.name}</td><td>${m.input === null ? 'Open Source' : 'Proprietary'}</td><td>${m.input !== null ? fmt(m.input) : 'Self-host'}</td><td>${m.output !== null ? fmt(m.output) : 'Self-host'}</td><td>${m.quality}/100</td></tr>`).join('\n')}
      </tbody>
    </table>

    <h2>When to Choose Open Source</h2>
    <ul>
      <li><strong>Data privacy:</strong> Sensitive data stays on your infrastructure</li>
      <li><strong>High volume:</strong> At 10M+ tokens/day, self-hosting can be cheaper than API pricing</li>
      <li><strong>Customization:</strong> Fine-tune on your domain data for better results</li>
      <li><strong>No rate limits:</strong> Scale throughput based on your GPU capacity</li>
      <li><strong>Regulatory:</strong> Meet compliance requirements for data residency</li>
    </ul>

    <h2>When to Choose API Models</h2>
    <ul>
      <li><strong>Low volume:</strong> Under 1M tokens/day, APIs are far cheaper than GPU rental</li>
      <li><strong>No ops overhead:</strong> Zero infrastructure to manage</li>
      <li><strong>Instant scaling:</strong> Handle traffic spikes without provisioning GPUs</li>
      <li><strong>Frontier quality:</strong> GPT-4o and Claude Opus 4 still lead benchmarks</li>
      <li><strong>Rapid iteration:</strong> Switch models with a single config change</li>
    </ul>

    <h2>Cost Breakeven Analysis</h2>
    <p>Self-hosting Llama 3 405B on 8xH100 costs approximately $23,000/month. At GPT-4o's pricing ($2.50/$10 per 1M tokens), you would need to process approximately <strong>3.7 million tokens per day</strong> (assuming 50/50 input/output split) before self-hosting becomes cheaper. For most startups and mid-size companies, API models are significantly more cost-effective.</p>`;
  }

  // Privacy section
  const privacySection = `
    <h2>Privacy & Data Handling</h2>
    <table>
      <thead>
        <tr><th>Aspect</th><th>${a.name}</th><th>${b.name}</th></tr>
      </thead>
      <tbody>
        <tr><td>Data retention</td><td>${a.input === null ? 'Your infrastructure — full control' : 'Not used for training (API)'}</td><td>${b.input === null ? 'Your infrastructure — full control' : 'Not used for training (API)'}</td></tr>
        <tr><td>SOC 2</td><td>${a.provider === 'Meta (open-source)' ? 'Self-managed' : 'Yes'}</td><td>${b.provider === 'Meta (open-source)' ? 'Self-managed' : 'Yes'}</td></tr>
        <tr><td>EU data residency</td><td>${a.provider === 'Mistral' ? 'Yes (EU servers)' : a.input === null ? 'Deploy anywhere' : 'Available on request'}</td><td>${b.provider === 'Mistral' ? 'Yes (EU servers)' : b.input === null ? 'Deploy anywhere' : 'Available on request'}</td></tr>
      </tbody>
    </table>`;

  const canonical = `${BASE_URL}/answers/${filename}`;

  let html = head(comp.title, desc, canonical, faqSchema(faqs));
  html += '\n' + nav();
  html += breadcrumb(comp.title.split(' — ')[0]);
  html += `\n\n  <div class="page-content">
    <h1>${comp.title.split(' — ')[0]}</h1>

    <p><strong>${comp.subtitle}. ${pricingVerdict} ${qualityVerdict}</strong></p>

    <h2>Side-by-Side Pricing</h2>
    <table>
      <thead>
        <tr><th>Metric</th><th>${a.name}</th><th>${b.name}</th></tr>
      </thead>
      <tbody>
        <tr><td>Input (per 1M tokens)</td><td>${aInput}</td><td>${bInput}</td></tr>
        <tr><td>Output (per 1M tokens)</td><td>${aOutput}</td><td>${bOutput}</td></tr>
        <tr><td>1-page summary cost</td><td>${a.input !== null ? costCalc(800, 400, a.input, a.output) : 'varies'}</td><td>${b.input !== null ? costCalc(800, 400, b.input, b.output) : 'varies'}</td></tr>
        <tr><td>10K conversation cost</td><td>${a.input !== null ? costCalc(8000, 2000, a.input, a.output) : 'varies'}</td><td>${b.input !== null ? costCalc(8000, 2000, b.input, b.output) : 'varies'}</td></tr>
      </tbody>
    </table>

    <h2>Quality & Benchmarks</h2>
    <table>
      <thead>
        <tr><th>Metric</th><th>${a.name}</th><th>${b.name}</th></tr>
      </thead>
      <tbody>
        <tr><td>Aggregate quality score</td><td>${a.quality}/100</td><td>${b.quality}/100</td></tr>
        <tr><td>Best for</td><td>${a.bestFor}</td><td>${b.bestFor}</td></tr>
        <tr><td>Provider</td><td>${a.provider}</td><td>${b.provider}</td></tr>
      </tbody>
    </table>

    <h2>Speed & Context Window</h2>
    <table>
      <thead>
        <tr><th>Metric</th><th>${a.name}</th><th>${b.name}</th></tr>
      </thead>
      <tbody>
        <tr><td>Speed (tokens/sec)</td><td>${a.speed}</td><td>${b.speed}</td></tr>
        <tr><td>Context window</td><td>${a.context}</td><td>${b.context}</td></tr>
      </tbody>
    </table>

    <p>${speedVerdict} ${a.name} supports ${a.context} context vs ${b.name}'s ${b.context}.</p>`;

  html += privacySection;
  html += comprehensiveSection;

  html += `

    <h2>Verdict: When to Pick Each</h2>
    <p>${overallVerdict}</p>
    <ul>
      <li><strong>${a.name}:</strong> Best when you need ${a.bestFor}</li>
      <li><strong>${b.name}:</strong> Best when you need ${b.bestFor}</li>
    </ul>

    <h2>FAQ</h2>`;
  for (const faq of faqs) {
    html += `
    <h3>${escHtml(faq.q)}</h3>
    <p>${escHtml(faq.a)}</p>`;
  }

  html += relatedLinks([filename]);
  html += disclaimer();
  html += calcCta();
  html += '\n  </div>';
  html += footer();

  return { filename, html, title: comp.title };
}

// ─── Pattern C: Use Case Cost Calculator Pages ──────────────────────────────

const USE_CASES = [
  {
    slug: 'cost-of-llm-chatbot-per-month',
    title: 'Cost of Running an LLM Chatbot Per Month',
    h1: 'How Much Does an LLM Chatbot Cost Per Month?',
    boldAnswer: 'An LLM-powered chatbot costs $50-$500/month for 1K conversations, $500-$5,000 for 10K, and $5,000-$50,000 for 100K conversations, depending on model choice and conversation length.',
    sections: () => {
      const rows = [
        ['claude-haiku-4', 2000, 500],
        ['gpt-4o-mini', 2000, 500],
        ['gemini-2-flash', 2000, 500],
        ['claude-sonnet-4', 2000, 500],
        ['gpt-4o', 2000, 500],
      ];
      let table = `
    <h2>Cost Per Conversation by Model</h2>
    <p>Average chatbot conversation: ~2,000 input tokens, ~500 output tokens.</p>
    <table>
      <thead>
        <tr><th>Model</th><th>Cost/Conversation</th><th>1K Convos/Month</th><th>10K Convos/Month</th><th>100K Convos/Month</th></tr>
      </thead>
      <tbody>`;
      for (const [key, inTok, outTok] of rows) {
        const m = MODELS[key];
        if (m.input === null) continue;
        const perConv = (inTok / 1e6) * m.input + (outTok / 1e6) * m.output;
        table += `
        <tr><td>${m.name}</td><td>${fmt(perConv)}</td><td>${fmt(perConv * 1000)}</td><td>${fmt(perConv * 10000)}</td><td>${fmt(perConv * 100000)}</td></tr>`;
      }
      table += `
      </tbody>
    </table>`;

      table += `

    <h2>Cost Optimization Strategies</h2>
    <ul>
      <li><strong>Model routing:</strong> Use a cheap model (Haiku/Mini) for simple questions, upgrade to Sonnet/4o for complex ones — saves 40-60%</li>
      <li><strong>Response caching:</strong> Cache common Q&A pairs — can reduce costs by 30-50%</li>
      <li><strong>Prompt optimization:</strong> Shorter system prompts mean fewer input tokens per call</li>
      <li><strong>Conversation summarization:</strong> Summarize context instead of sending full history — reduces input tokens by 70%</li>
    </ul>

    <h2>Hidden Costs to Consider</h2>
    <ul>
      <li>Embedding model costs for RAG retrieval (~$0.10/1M tokens)</li>
      <li>Vector database hosting ($20-200/month)</li>
      <li>Infrastructure and monitoring ($50-500/month)</li>
      <li>Content moderation API calls</li>
    </ul>`;
      return table;
    },
    faqs: [
      { q: 'What is the cheapest model for a chatbot?', a: 'Gemini 2.0 Flash at $0.075/$0.30 per 1M tokens is the cheapest major-provider model. GPT-4o Mini at $0.15/$0.60 is a close second. Both handle basic chatbot conversations well.' },
      { q: 'How many tokens does a chatbot conversation use?', a: 'A typical chatbot conversation uses 2,000-5,000 input tokens (including system prompt and context) and 500-1,500 output tokens. Multi-turn conversations accumulate more input tokens as history grows.' },
      { q: 'Can I run a chatbot for free?', a: 'You can run a local model with Ollama (free, but requires a capable GPU/Mac). Google also offers a free tier for Gemini API with rate limits. For production use, expect to pay for API calls.' },
    ],
  },
  {
    slug: 'cost-of-ai-code-review',
    title: 'Cost of AI Code Review Per Pull Request',
    h1: 'How Much Does AI Code Review Cost?',
    boldAnswer: 'AI code review costs $0.01-$0.05 per small PR (under 500 lines) using budget models, or $0.10-$0.50 per PR using premium models like Claude Opus 4. At 100 PRs/day, expect $3-$50/month.',
    sections: () => {
      const prSizes = [
        { name: 'Small PR (~200 lines)', inputTokens: 3000, outputTokens: 800 },
        { name: 'Medium PR (~500 lines)', inputTokens: 8000, outputTokens: 1500 },
        { name: 'Large PR (~2000 lines)', inputTokens: 25000, outputTokens: 3000 },
      ];
      const models = ['claude-sonnet-4', 'gpt-4o', 'claude-haiku-4', 'gpt-4o-mini', 'deepseek-v3'];

      let table = `
    <h2>Cost Per Pull Request by Size and Model</h2>
    <table>
      <thead>
        <tr><th>Model</th>`;
      for (const pr of prSizes) table += `<th>${pr.name}</th>`;
      table += `</tr>
      </thead>
      <tbody>`;
      for (const mk of models) {
        const m = MODELS[mk];
        table += `
        <tr><td>${m.name}</td>`;
        for (const pr of prSizes) {
          table += `<td>${costCalc(pr.inputTokens, pr.outputTokens, m.input, m.output)}</td>`;
        }
        table += `</tr>`;
      }
      table += `
      </tbody>
    </table>

    <h2>Monthly Cost at Scale (100 PRs/day)</h2>
    <table>
      <thead>
        <tr><th>Model</th><th>Small PRs</th><th>Medium PRs</th><th>Mixed</th></tr>
      </thead>
      <tbody>`;
      for (const mk of models) {
        const m = MODELS[mk];
        const small = ((3000/1e6)*m.input + (800/1e6)*m.output) * 100 * 30;
        const med = ((8000/1e6)*m.input + (1500/1e6)*m.output) * 100 * 30;
        const mixed = (small + med) / 2;
        table += `
        <tr><td>${m.name}</td><td>${fmt(small)}</td><td>${fmt(med)}</td><td>${fmt(mixed)}</td></tr>`;
      }
      table += `
      </tbody>
    </table>

    <h2>Best Models for Code Review</h2>
    <ul>
      <li><strong>Claude Sonnet 4</strong> — Best overall for code review: strong at finding bugs, good value at $3/$15</li>
      <li><strong>DeepSeek V3</strong> — Budget option with strong coding ability at $0.27/$1.10</li>
      <li><strong>GPT-4o</strong> — Good all-rounder, especially for multi-language codebases</li>
      <li><strong>Claude Haiku 4</strong> — Best for lint-level checks and simple reviews at scale</li>
    </ul>`;
      return table;
    },
    faqs: [
      { q: 'Which AI model is best for code review?', a: 'Claude Sonnet 4 offers the best balance of code understanding and cost at $3/$15 per 1M tokens. For budget code review, DeepSeek V3 at $0.27/$1.10 provides strong coding ability at a fraction of the cost.' },
      { q: 'How many tokens does a code review use?', a: 'A small PR (200 lines) uses about 3,000 input tokens. A large PR (2,000 lines) uses about 25,000 input tokens. Output is typically 800-3,000 tokens for review comments.' },
      { q: 'Is AI code review worth the cost?', a: 'At $0.01-$0.50 per PR, AI code review is extremely cost-effective compared to engineer time ($50-150/hour). It catches common issues, enforces style, and frees senior engineers for deeper reviews.' },
    ],
  },
  {
    slug: 'cost-of-ai-customer-support',
    title: 'Cost of AI Customer Support Per Ticket',
    h1: 'How Much Does AI Customer Support Cost Per Ticket?',
    boldAnswer: 'AI customer support costs $0.002-$0.02 per ticket with budget models (Gemini Flash, GPT-4o Mini) or $0.02-$0.15 per ticket with premium models. This is 10-50x cheaper than human agents at $5-15 per ticket.',
    sections: () => {
      const ticketSize = { inputTokens: 1500, outputTokens: 600 };
      const models = ['gemini-2-flash', 'gpt-4o-mini', 'claude-haiku-4', 'deepseek-v3', 'claude-sonnet-4', 'gpt-4o'];

      let table = `
    <h2>Cost Per Support Ticket by Model</h2>
    <p>Average support ticket: ~1,500 input tokens (customer message + knowledge base context), ~600 output tokens.</p>
    <table>
      <thead>
        <tr><th>Model</th><th>Cost/Ticket</th><th>1K Tickets/Month</th><th>10K Tickets/Month</th><th>100K Tickets/Month</th></tr>
      </thead>
      <tbody>`;
      for (const mk of models) {
        const m = MODELS[mk];
        if (m.input === null) continue;
        const perTicket = (ticketSize.inputTokens / 1e6) * m.input + (ticketSize.outputTokens / 1e6) * m.output;
        table += `
        <tr><td>${m.name}</td><td>${fmt(perTicket)}</td><td>${fmt(perTicket * 1000)}</td><td>${fmt(perTicket * 10000)}</td><td>${fmt(perTicket * 100000)}</td></tr>`;
      }
      table += `
      </tbody>
    </table>

    <h2>AI vs Human Support Cost Comparison</h2>
    <table>
      <thead>
        <tr><th>Metric</th><th>AI (GPT-4o Mini)</th><th>AI (Claude Sonnet 4)</th><th>Human Agent</th></tr>
      </thead>
      <tbody>
        <tr><td>Cost per ticket</td><td>$0.001</td><td>$0.014</td><td>$5-15</td></tr>
        <tr><td>10K tickets/month</td><td>$6</td><td>$135</td><td>$50,000-150,000</td></tr>
        <tr><td>Response time</td><td>2-5 seconds</td><td>3-8 seconds</td><td>2-24 hours</td></tr>
        <tr><td>24/7 availability</td><td>Yes</td><td>Yes</td><td>Requires shifts</td></tr>
        <tr><td>Escalation rate</td><td>15-30%</td><td>10-20%</td><td>5-10%</td></tr>
      </tbody>
    </table>

    <h2>Recommended Architecture</h2>
    <ul>
      <li><strong>Tier 1 — Instant (80% of tickets):</strong> GPT-4o Mini or Gemini Flash for FAQ-style queries. Cost: ~$0.001/ticket</li>
      <li><strong>Tier 2 — Complex (15% of tickets):</strong> Claude Sonnet 4 for nuanced issues. Cost: ~$0.014/ticket</li>
      <li><strong>Tier 3 — Human (5% of tickets):</strong> Escalate to human agents for edge cases. Cost: ~$10/ticket</li>
      <li><strong>Blended cost:</strong> ~$0.50-$1.00 per ticket at scale</li>
    </ul>`;
      return table;
    },
    faqs: [
      { q: 'What is the cheapest AI for customer support?', a: 'Gemini 2.0 Flash at $0.075/$0.30 per 1M tokens is the cheapest option from a major provider. At ~$0.0003 per ticket, you can handle 100,000 tickets/month for under $30.' },
      { q: 'Can AI fully replace human support agents?', a: 'AI can handle 70-90% of common support queries. Complex issues, emotional situations, and edge cases still benefit from human agents. A tiered approach (AI first, human escalation) is most cost-effective.' },
      { q: 'How accurate is AI customer support?', a: 'With proper RAG (retrieval-augmented generation) setup and quality knowledge base, AI support achieves 85-95% accuracy on common questions. Quality improves with better training data and prompt engineering.' },
    ],
  },
  {
    slug: 'cost-to-summarize-1000-documents',
    title: 'Cost to Summarize 1,000 Documents with AI',
    h1: 'How Much Does It Cost to Summarize 1,000 Documents?',
    boldAnswer: 'Summarizing 1,000 documents (avg 2,000 words each) costs $0.90-$3.50 with budget models (Gemini Flash, GPT-4o Mini) or $15-$100 with premium models (Claude Opus 4, GPT-4o). Processing takes 10-60 minutes.',
    sections: () => {
      // 2000 words ~= 2700 tokens input, 400 token summary output
      const docTokens = { input: 2700, output: 400 };
      const batchSize = 1000;
      const models = ['gemini-2-flash', 'gpt-4o-mini', 'deepseek-v3', 'claude-haiku-4', 'claude-sonnet-4', 'gpt-4o', 'claude-opus-4'];

      let table = `
    <h2>Cost to Summarize 1,000 Documents</h2>
    <p>Assuming average document: 2,000 words (~2,700 tokens), summary output: ~400 tokens.</p>
    <table>
      <thead>
        <tr><th>Model</th><th>Cost/Document</th><th>Cost/1,000 Docs</th><th>Est. Time</th></tr>
      </thead>
      <tbody>`;
      for (const mk of models) {
        const m = MODELS[mk];
        if (m.input === null) continue;
        const perDoc = (docTokens.input / 1e6) * m.input + (docTokens.output / 1e6) * m.output;
        const speed = parseInt(m.speed);
        const timePerDoc = docTokens.output / speed; // seconds
        const totalTime = (timePerDoc * batchSize) / 60; // minutes (sequential)
        const parallelTime = Math.max(totalTime / 50, 1); // assume 50x parallelism
        table += `
        <tr><td>${m.name}</td><td>${fmt(perDoc)}</td><td>${fmt(perDoc * batchSize)}</td><td>~${Math.round(parallelTime)} min</td></tr>`;
      }
      table += `
      </tbody>
    </table>

    <h2>Scaling: 10K and 100K Documents</h2>
    <table>
      <thead>
        <tr><th>Model</th><th>10K Documents</th><th>100K Documents</th></tr>
      </thead>
      <tbody>`;
      for (const mk of ['gemini-2-flash', 'gpt-4o-mini', 'claude-haiku-4', 'claude-sonnet-4']) {
        const m = MODELS[mk];
        const perDoc = (docTokens.input / 1e6) * m.input + (docTokens.output / 1e6) * m.output;
        table += `
        <tr><td>${m.name}</td><td>${fmt(perDoc * 10000)}</td><td>${fmt(perDoc * 100000)}</td></tr>`;
      }
      table += `
      </tbody>
    </table>

    <h2>Optimization Tips for Batch Summarization</h2>
    <ul>
      <li><strong>Use batch APIs:</strong> OpenAI and Anthropic offer 50% discount on batch API calls</li>
      <li><strong>Parallel processing:</strong> Run 50-100 concurrent requests to maximize throughput</li>
      <li><strong>Tiered quality:</strong> Use Gemini Flash for initial summaries, upgrade important documents to Sonnet/4o</li>
      <li><strong>Chunk long documents:</strong> For documents over 10K words, summarize in chunks then consolidate</li>
    </ul>`;
      return table;
    },
    faqs: [
      { q: 'What is the cheapest way to summarize documents with AI?', a: 'Gemini 2.0 Flash at $0.075/$0.30 per 1M tokens is the cheapest option. Summarizing 1,000 two-page documents costs under $1. For even cheaper options, use batch APIs for 50% off.' },
      { q: 'How long does it take to summarize 1,000 documents?', a: 'With parallel processing (50 concurrent requests), most models can summarize 1,000 documents in 1-10 minutes. Sequential processing takes 30-120 minutes depending on model speed.' },
      { q: 'Which model writes the best summaries?', a: 'Claude Opus 4 and GPT-4o produce the highest quality summaries with better nuance and accuracy. For most use cases, Claude Sonnet 4 offers nearly equivalent quality at 80% lower cost.' },
    ],
  },
  {
    slug: 'cost-of-rag-pipeline',
    title: 'Cost of a RAG Pipeline — Embedding + Retrieval + Generation',
    h1: 'How Much Does a RAG Pipeline Cost?',
    boldAnswer: 'A RAG pipeline costs $0.001-$0.05 per query: embedding (~$0.0001), vector DB lookup (~$0.0001), and LLM generation ($0.001-$0.05). At 10K queries/day, expect $10-$500/month plus $20-$200/month for vector DB hosting.',
    sections: () => {
      const ragModels = ['gemini-2-flash', 'gpt-4o-mini', 'claude-haiku-4', 'deepseek-v3', 'claude-sonnet-4', 'gpt-4o'];
      // RAG query: 500 token query + 2000 token context retrieved + 800 token response
      const ragTokens = { input: 2500, output: 800 };

      let table = `
    <h2>RAG Pipeline Cost Breakdown</h2>
    <table>
      <thead>
        <tr><th>Component</th><th>Cost Per Query</th><th>10K Queries/Day</th><th>Notes</th></tr>
      </thead>
      <tbody>
        <tr><td>Embedding (query)</td><td>~$0.0001</td><td>~$1/month</td><td>text-embedding-3-small at $0.02/1M tokens</td></tr>
        <tr><td>Vector DB lookup</td><td>~$0.0001</td><td>$20-200/month (hosting)</td><td>Pinecone, Weaviate, or pgvector</td></tr>
        <tr><td>LLM generation</td><td>$0.001-$0.05</td><td>$10-$500/month</td><td>Varies by model (see below)</td></tr>
      </tbody>
    </table>

    <h2>LLM Generation Cost by Model</h2>
    <p>Per query: ~2,500 input tokens (query + retrieved context), ~800 output tokens.</p>
    <table>
      <thead>
        <tr><th>Model</th><th>Cost/Query</th><th>10K/Day Monthly</th><th>100K/Day Monthly</th></tr>
      </thead>
      <tbody>`;
      for (const mk of ragModels) {
        const m = MODELS[mk];
        const perQuery = (ragTokens.input / 1e6) * m.input + (ragTokens.output / 1e6) * m.output;
        table += `
        <tr><td>${m.name}</td><td>${fmt(perQuery)}</td><td>${fmt(perQuery * 10000 * 30)}</td><td>${fmt(perQuery * 100000 * 30)}</td></tr>`;
      }
      table += `
      </tbody>
    </table>

    <h2>One-Time Indexing Costs</h2>
    <p>Embedding your document corpus is a one-time cost (plus re-indexing for updates).</p>
    <table>
      <thead>
        <tr><th>Corpus Size</th><th>Tokens (est.)</th><th>Embedding Cost</th></tr>
      </thead>
      <tbody>
        <tr><td>1,000 pages</td><td>~1.5M tokens</td><td>$0.03</td></tr>
        <tr><td>10,000 pages</td><td>~15M tokens</td><td>$0.30</td></tr>
        <tr><td>100,000 pages</td><td>~150M tokens</td><td>$3.00</td></tr>
        <tr><td>1M pages</td><td>~1.5B tokens</td><td>$30.00</td></tr>
      </tbody>
    </table>

    <h2>Vector Database Costs</h2>
    <table>
      <thead>
        <tr><th>Provider</th><th>Free Tier</th><th>Production</th><th>Best For</th></tr>
      </thead>
      <tbody>
        <tr><td>Pinecone</td><td>100K vectors</td><td>$70+/month</td><td>Managed, scalable</td></tr>
        <tr><td>Weaviate Cloud</td><td>1M vectors</td><td>$25+/month</td><td>Hybrid search</td></tr>
        <tr><td>pgvector (self-hosted)</td><td>Unlimited</td><td>$10-50/month (VPS)</td><td>Simple, PostgreSQL users</td></tr>
        <tr><td>Qdrant Cloud</td><td>1M vectors</td><td>$25+/month</td><td>Performance-focused</td></tr>
      </tbody>
    </table>`;
      return table;
    },
    faqs: [
      { q: 'How much does a RAG pipeline cost per query?', a: 'A RAG query costs $0.001-$0.05 total: ~$0.0001 for embedding, ~$0.0001 for vector lookup, and $0.001-$0.05 for LLM generation depending on model choice. The LLM generation step is 95%+ of the cost.' },
      { q: 'What is the cheapest way to build a RAG pipeline?', a: 'Use Gemini 2.0 Flash ($0.075/$0.30) for generation, text-embedding-3-small for embeddings, and pgvector on a $10/month VPS for storage. Total cost: under $20/month for 10K queries/day.' },
      { q: 'Do I need a vector database for RAG?', a: 'For small corpora (under 10K documents), you can use simple in-memory search or SQLite FTS. For larger corpora, a vector database provides faster retrieval and better relevance. pgvector is a good free starting point.' },
    ],
  },
  {
    slug: 'cheapest-way-to-build-ai-app',
    title: 'Cheapest Way to Build an AI App in 2026',
    h1: 'What Is the Cheapest Way to Build an AI App?',
    boldAnswer: 'Start with the cheapest model that works (Gemini Flash at $0.075/$0.30 or GPT-4o Mini at $0.15/$0.60), then upgrade only when quality demands it. A tiered approach with model routing can cut costs by 50-70% compared to using a single premium model.',
    sections: () => {
      return `
    <h2>Tiered Approach: Start Cheap, Upgrade as Needed</h2>
    <table>
      <thead>
        <tr><th>Phase</th><th>Model</th><th>Monthly Cost (10K reqs/day)</th><th>When to Use</th></tr>
      </thead>
      <tbody>
        <tr><td>1. MVP/Prototype</td><td>Gemini 2.0 Flash</td><td>${fmt(((1000/1e6)*0.075 + (500/1e6)*0.30) * 10000 * 30)}</td><td>Validate idea, test UX</td></tr>
        <tr><td>2. Beta Launch</td><td>GPT-4o Mini</td><td>${fmt(((1000/1e6)*0.15 + (500/1e6)*0.60) * 10000 * 30)}</td><td>Better quality, still cheap</td></tr>
        <tr><td>3. Production</td><td>Claude Sonnet 4</td><td>${fmt(((1000/1e6)*3 + (500/1e6)*15) * 10000 * 30)}</td><td>Quality matters, users pay</td></tr>
        <tr><td>4. Premium Tier</td><td>Claude Opus 4</td><td>${fmt(((1000/1e6)*15 + (500/1e6)*75) * 10000 * 30)}</td><td>Complex tasks, enterprise</td></tr>
      </tbody>
    </table>

    <h2>Model Routing: Use the Right Model for Each Task</h2>
    <p>Instead of using one model for everything, route requests based on complexity:</p>
    <table>
      <thead>
        <tr><th>Task Complexity</th><th>% of Requests</th><th>Model</th><th>Cost/Request</th></tr>
      </thead>
      <tbody>
        <tr><td>Simple (FAQ, classification)</td><td>60%</td><td>Gemini Flash / GPT-4o Mini</td><td>~$0.0005</td></tr>
        <tr><td>Medium (writing, analysis)</td><td>30%</td><td>Claude Sonnet 4 / GPT-4o</td><td>~$0.015</td></tr>
        <tr><td>Complex (reasoning, code)</td><td>10%</td><td>Claude Opus 4</td><td>~$0.05</td></tr>
        <tr><td colspan="2"><strong>Blended average</strong></td><td></td><td><strong>~$0.010</strong></td></tr>
      </tbody>
    </table>
    <p>vs. using Claude Sonnet 4 for everything: ~$0.015/request (33% more expensive).</p>

    <h2>Infrastructure Cost Breakdown</h2>
    <table>
      <thead>
        <tr><th>Component</th><th>Free Option</th><th>Production</th></tr>
      </thead>
      <tbody>
        <tr><td>LLM API</td><td>Free tiers (Gemini, some limits)</td><td>$10-$5,000/month</td></tr>
        <tr><td>Hosting</td><td>Vercel/Cloudflare free tier</td><td>$5-50/month</td></tr>
        <tr><td>Database</td><td>Supabase/PlanetScale free tier</td><td>$10-100/month</td></tr>
        <tr><td>Auth</td><td>Clerk/Auth0 free tier</td><td>$25-100/month</td></tr>
        <tr><td>Monitoring</td><td>Helicone free tier</td><td>$20-100/month</td></tr>
        <tr><td><strong>Total</strong></td><td><strong>$0/month</strong></td><td><strong>$65-$5,350/month</strong></td></tr>
      </tbody>
    </table>

    <h2>Cost-Saving Best Practices</h2>
    <ul>
      <li><strong>Prompt caching:</strong> Anthropic and OpenAI cache repeated prompt prefixes — saves 50-90% on input tokens</li>
      <li><strong>Semantic caching:</strong> Cache similar queries with embedding similarity — saves 30-50% of API calls</li>
      <li><strong>Streaming:</strong> Stream responses for better UX at the same cost</li>
      <li><strong>Batch API:</strong> Use batch endpoints for non-realtime tasks — 50% discount</li>
      <li><strong>Output length limits:</strong> Set max_tokens to prevent runaway generation costs</li>
      <li><strong>Evaluate before upgrading:</strong> Test if a cheaper model actually performs worse for your specific task</li>
    </ul>`;
    },
    faqs: [
      { q: 'What is the cheapest LLM for building an app?', a: 'Gemini 2.0 Flash at $0.075/$0.30 per 1M tokens is the cheapest from a major provider. For the absolute cheapest, Groq offers Llama 3 8B at $0.05/$0.08 per 1M tokens.' },
      { q: 'How much does it cost to build an AI app?', a: 'An AI app MVP can be built for $0/month using free tiers. A production app with 10K daily users typically costs $100-$1,000/month for API calls plus $50-$300/month for infrastructure.' },
      { q: 'Should I use one model or multiple models?', a: 'Multiple models with routing is always cheaper. Use a cheap model (Flash/Mini) for 60% of simple requests and a premium model for 10% of complex ones. This saves 40-60% vs using a single mid-tier model.' },
    ],
  },
  {
    slug: 'llm-api-cost-optimization-tips',
    title: 'LLM API Cost Optimization Tips — Save 50-80% on API Costs',
    h1: 'LLM API Cost Optimization: 12 Tips to Cut Your Bill',
    boldAnswer: 'The top LLM cost optimizations: prompt caching (save 50-90% on repeated prefixes), model routing (save 40-60% by using cheap models for simple tasks), and response caching (save 30-50% on duplicate queries). Combined, these can reduce your API bill by 50-80%.',
    sections: () => {
      return `
    <h2>1. Prompt Caching</h2>
    <p>Anthropic and OpenAI automatically cache repeated prompt prefixes. If your system prompt is 2,000 tokens and you make 1,000 calls:</p>
    <table>
      <thead>
        <tr><th>Approach</th><th>Input Tokens Billed</th><th>Cost (Claude Sonnet 4)</th></tr>
      </thead>
      <tbody>
        <tr><td>Without caching</td><td>2,000,000</td><td>${fmt(2000000/1e6 * 3)}</td></tr>
        <tr><td>With prompt caching</td><td>~200,000 (90% cached)</td><td>${fmt(200000/1e6 * 3)}</td></tr>
        <tr><td><strong>Savings</strong></td><td></td><td><strong>90%</strong></td></tr>
      </tbody>
    </table>

    <h2>2. Model Routing</h2>
    <p>Route simple tasks to cheap models, complex tasks to premium ones:</p>
    <pre><code># Simple router based on input length and keywords
def route_model(prompt):
    if len(prompt) < 200 and not any(w in prompt for w in ['analyze', 'compare', 'explain']):
        return "gemini-2.0-flash"      # $0.075/$0.30
    elif any(w in prompt for w in ['code', 'debug', 'review']):
        return "claude-sonnet-4"        # $3/$15
    else:
        return "gpt-4o-mini"            # $0.15/$0.60</code></pre>

    <h2>3. Response Caching</h2>
    <p>Cache identical or semantically similar queries. Use embedding similarity with a threshold of 0.95+ for semantic matching.</p>

    <h2>4. Shorter Prompts</h2>
    <p>Every token in your system prompt is billed on every request. Reducing a 2,000-token system prompt to 500 tokens saves 75% on input costs for that portion.</p>
    <table>
      <thead>
        <tr><th>System Prompt Size</th><th>Monthly Cost at 10K req/day (Sonnet 4)</th></tr>
      </thead>
      <tbody>
        <tr><td>2,000 tokens</td><td>${fmt((2000/1e6) * 3 * 10000 * 30)}</td></tr>
        <tr><td>500 tokens</td><td>${fmt((500/1e6) * 3 * 10000 * 30)}</td></tr>
        <tr><td><strong>Savings</strong></td><td><strong>${fmt(((2000-500)/1e6) * 3 * 10000 * 30)}/month</strong></td></tr>
      </tbody>
    </table>

    <h2>5. Batch API (50% Off)</h2>
    <p>Both OpenAI and Anthropic offer batch APIs at 50% discount for non-realtime processing. Use for document summarization, data extraction, and offline analysis.</p>

    <h2>6. Set max_tokens</h2>
    <p>Always set a reasonable max_tokens limit. A runaway 4,000-token response when you only need 200 tokens costs 20x more on output.</p>

    <h2>7. Conversation Summarization</h2>
    <p>Instead of sending full conversation history, summarize previous turns. A 20-turn conversation might have 15,000 tokens of history — summarize to 500 tokens for 97% input savings.</p>

    <h2>8. Use Structured Output</h2>
    <p>JSON mode and structured outputs produce shorter, more parseable responses. Typically 30-50% fewer output tokens than free-form text.</p>

    <h2>9. Fine-Tuning (for high volume)</h2>
    <p>At 1M+ requests/month, fine-tuning a smaller model on your specific task can match larger model quality at 10-50x lower per-request cost.</p>

    <h2>10. Embedding Model Selection</h2>
    <p>Use text-embedding-3-small ($0.02/1M tokens) instead of text-embedding-3-large ($0.13/1M tokens) unless you need maximum retrieval quality. The small model is 85-90% as good at 85% less cost.</p>

    <h2>11. Rate Limit Awareness</h2>
    <p>Avoid retries caused by rate limits — they waste tokens and time. Implement proper exponential backoff and request queuing.</p>

    <h2>12. Monitor and Alert</h2>
    <p>Use tools like Helicone, LangSmith, or custom dashboards to track cost per feature, per user, and per model. Set budget alerts to catch runaway costs early.</p>

    <h2>Combined Savings Example</h2>
    <table>
      <thead>
        <tr><th>Optimization</th><th>Savings</th><th>Cumulative Bill</th></tr>
      </thead>
      <tbody>
        <tr><td>Baseline (Claude Sonnet 4, 10K req/day)</td><td>—</td><td>$2,700/month</td></tr>
        <tr><td>+ Model routing (60% to Flash)</td><td>-45%</td><td>$1,485/month</td></tr>
        <tr><td>+ Prompt caching</td><td>-30%</td><td>$1,040/month</td></tr>
        <tr><td>+ Response caching (30% hit rate)</td><td>-30%</td><td>$728/month</td></tr>
        <tr><td>+ Shorter prompts</td><td>-15%</td><td>$619/month</td></tr>
        <tr><td><strong>Total savings</strong></td><td><strong>77%</strong></td><td><strong>$619/month</strong></td></tr>
      </tbody>
    </table>`;
    },
    faqs: [
      { q: 'What is the easiest way to reduce LLM API costs?', a: 'Model routing is the easiest win: send simple queries to Gemini Flash ($0.075/$0.30) and complex ones to a premium model. This alone saves 40-60% with minimal code changes.' },
      { q: 'Does prompt caching really save money?', a: 'Yes. Anthropic and OpenAI cache repeated prompt prefixes automatically. If your system prompt is constant across requests, you save up to 90% on input tokens for that portion after the first request.' },
      { q: 'How much can I save on LLM API costs?', a: 'Combining model routing, prompt caching, response caching, and shorter prompts can reduce costs by 50-80%. A $2,700/month bill can drop to $600-$800/month with these optimizations.' },
    ],
  },
];

function generateUseCasePage(uc) {
  const filename = `${uc.slug}.html`;
  const desc = uc.boldAnswer.substring(0, 160);
  const canonical = `${BASE_URL}/answers/${filename}`;

  let html = head(uc.title, desc, canonical, faqSchema(uc.faqs));
  html += '\n' + nav();
  html += breadcrumb(uc.title.split(' — ')[0]);
  html += `\n\n  <div class="page-content">
    <h1>${uc.h1}</h1>

    <p><strong>${uc.boldAnswer}</strong></p>`;

  html += typeof uc.sections === 'function' ? uc.sections() : uc.sections;

  html += `

    <h2>FAQ</h2>`;
  for (const faq of uc.faqs) {
    html += `
    <h3>${escHtml(faq.q)}</h3>
    <p>${escHtml(faq.a)}</p>`;
  }

  html += relatedLinks([filename]);
  html += disclaimer();
  html += calcCta();
  html += '\n  </div>';
  html += footer();

  return { filename, html, title: uc.title };
}

// ─── Main generation ─────────────────────────────────────────────────────────

function main() {
  const generated = [];

  // Pattern A: Model-specific pricing pages
  console.log('Generating Pattern A: Model-Specific Pricing Pages...');
  for (const key of Object.keys(MODELS)) {
    const page = generateModelPage(key);
    if (PROTECTED.has(page.filename)) {
      console.log(`  SKIP (protected): ${page.filename}`);
      continue;
    }
    fs.writeFileSync(path.join(ANSWERS_DIR, page.filename), page.html);
    generated.push(page);
    console.log(`  WROTE: ${page.filename}`);
  }

  // Pattern B: Comparison pages
  console.log('Generating Pattern B: Head-to-Head Comparisons...');
  for (const comp of COMPARISONS) {
    const page = generateComparisonPage(comp);
    if (PROTECTED.has(page.filename)) {
      console.log(`  SKIP (protected): ${page.filename}`);
      continue;
    }
    fs.writeFileSync(path.join(ANSWERS_DIR, page.filename), page.html);
    generated.push(page);
    console.log(`  WROTE: ${page.filename}`);
  }

  // Pattern C: Use case cost calculators
  console.log('Generating Pattern C: Use Case Cost Calculators...');
  for (const uc of USE_CASES) {
    const page = generateUseCasePage(uc);
    if (PROTECTED.has(page.filename)) {
      console.log(`  SKIP (protected): ${page.filename}`);
      continue;
    }
    fs.writeFileSync(path.join(ANSWERS_DIR, page.filename), page.html);
    generated.push(page);
    console.log(`  WROTE: ${page.filename}`);
  }

  console.log(`\nGenerated ${generated.length} pages.`);

  // Update sitemap
  console.log('Updating sitemap...');
  let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');

  for (const page of generated) {
    const url = `${BASE_URL}/answers/${page.filename}`;
    if (!sitemap.includes(url)) {
      const entry = `  <url>
    <loc>${url}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;
      sitemap = sitemap.replace('</urlset>', entry + '\n</urlset>');
    }
  }

  fs.writeFileSync(SITEMAP_PATH, sitemap);
  console.log('Sitemap updated.');

  return generated;
}

main();
