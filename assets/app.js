/* kickllm.com — LLM Cost Calculator */
'use strict';

var MODELS = [
  { id:"claude-35-sonnet", name:"Claude 3.5 Sonnet", provider:"Anthropic", inputPrice:3.00, outputPrice:15.00 },
  { id:"claude-3-opus", name:"Claude 3 Opus", provider:"Anthropic", inputPrice:15.00, outputPrice:75.00 },
  { id:"gpt-4o", name:"GPT-4o", provider:"OpenAI", inputPrice:5.00, outputPrice:15.00 },
  { id:"gpt-4-turbo", name:"GPT-4 Turbo", provider:"OpenAI", inputPrice:10.00, outputPrice:30.00 },
  { id:"gemini-15-pro", name:"Gemini 1.5 Pro", provider:"Google", inputPrice:3.50, outputPrice:10.50 },
  { id:"llama3-70b-groq", name:"Llama 3 70B (Groq)", provider:"Groq", inputPrice:0.59, outputPrice:0.79 },
  { id:"mistral-large", name:"Mistral Large", provider:"Mistral AI", inputPrice:4.00, outputPrice:12.00 }
];

var mode = 'monthly'; // 'monthly' or 'conversation'

function init() {
  renderModelChecks();
  bindEvents();
  calculate();
}

function renderModelChecks() {
  var container = document.getElementById('model-list');
  if (!container) return;
  var html = '';
  for (var i = 0; i < MODELS.length && i < 50; i++) {
    var m = MODELS[i];
    var checked = (i < 4) ? ' checked' : '';
    html += '<label class="model-check">';
    html += '<input type="checkbox" value="' + m.id + '"' + checked + '>';
    html += '<span class="model-name">' + m.name + '</span>';
    html += '<span class="model-price">$' + m.inputPrice.toFixed(2) + '/$' + m.outputPrice.toFixed(2) + '</span>';
    html += '</label>';
  }
  container.innerHTML = html;
}

function getSelectedModels() {
  var checks = document.querySelectorAll('#model-list input[type="checkbox"]:checked');
  var selected = [];
  for (var i = 0; i < checks.length && i < 50; i++) {
    var id = checks[i].value;
    for (var j = 0; j < MODELS.length && j < 50; j++) {
      if (MODELS[j].id === id) { selected.push(MODELS[j]); break; }
    }
  }
  return selected;
}

function getInputs() {
  if (mode === 'monthly') {
    return {
      tokensPerReq: parseInt(document.getElementById('tokens-per-req').value, 10) || 1000,
      reqsPerDay: parseInt(document.getElementById('reqs-per-day').value, 10) || 100,
      daysPerMonth: parseInt(document.getElementById('days-per-month').value, 10) || 30,
      ioRatio: parseInt(document.getElementById('io-ratio').value, 10) || 50
    };
  } else {
    return {
      inputTokens: parseInt(document.getElementById('conv-input-tokens').value, 10) || 2000,
      outputTokens: parseInt(document.getElementById('conv-output-tokens').value, 10) || 500,
      turns: parseInt(document.getElementById('conv-turns').value, 10) || 5
    };
  }
}

function calculate() {
  var models = getSelectedModels();
  var inputs = getInputs();
  var results = [];

  for (var i = 0; i < models.length && i < 50; i++) {
    var m = models[i];
    var cost;
    if (mode === 'monthly') {
      var totalTokens = inputs.tokensPerReq * inputs.reqsPerDay * inputs.daysPerMonth;
      var inputTokens = totalTokens * (inputs.ioRatio / 100);
      var outputTokens = totalTokens * (1 - inputs.ioRatio / 100);
      cost = (inputTokens / 1e6) * m.inputPrice + (outputTokens / 1e6) * m.outputPrice;
      results.push({
        name: m.name,
        provider: m.provider,
        totalTokens: totalTokens,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        cost: cost
      });
    } else {
      var totalInput = inputs.inputTokens * inputs.turns;
      var totalOutput = inputs.outputTokens * inputs.turns;
      cost = (totalInput / 1e6) * m.inputPrice + (totalOutput / 1e6) * m.outputPrice;
      results.push({
        name: m.name,
        provider: m.provider,
        totalInput: totalInput,
        totalOutput: totalOutput,
        cost: cost
      });
    }
  }

  results.sort(function(a, b) { return a.cost - b.cost; });
  renderResults(results);
  renderChart(results);
}

function renderResults(results) {
  var tbody = document.getElementById('results-body');
  if (!tbody) return;
  var html = '';
  if (results.length === 0) {
    html = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Select at least one model</td></tr>';
    tbody.innerHTML = html;
    return;
  }
  var cheapestCost = results[0].cost;
  for (var i = 0; i < results.length && i < 50; i++) {
    var r = results[i];
    var isCheapest = (r.cost === cheapestCost) ? ' class="cheapest"' : '';
    html += '<tr' + isCheapest + '>';
    html += '<td>' + esc(r.name) + '</td>';
    html += '<td>' + esc(r.provider) + '</td>';
    if (mode === 'monthly') {
      html += '<td>' + formatNum(r.totalTokens) + '</td>';
      html += '<td class="cost">$' + formatCost(r.cost) + '/mo</td>';
    } else {
      html += '<td>' + formatNum(r.totalInput + r.totalOutput) + '</td>';
      html += '<td class="cost">$' + formatCost(r.cost) + '/conv</td>';
    }
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

function renderChart(results) {
  var container = document.getElementById('chart-container');
  if (!container) return;
  if (results.length === 0) { container.innerHTML = ''; return; }
  var maxCost = 0;
  for (var i = 0; i < results.length && i < 50; i++) {
    if (results[i].cost > maxCost) maxCost = results[i].cost;
  }
  if (maxCost === 0) maxCost = 1;
  var html = '';
  for (var i = 0; i < results.length && i < 50; i++) {
    var r = results[i];
    var pct = Math.max(1, (r.cost / maxCost) * 100);
    var suffix = mode === 'monthly' ? '/mo' : '/conv';
    html += '<div class="bar-row">';
    html += '<div class="bar-label">' + esc(r.name) + '</div>';
    html += '<div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>';
    html += '<div class="bar-value">$' + formatCost(r.cost) + suffix + '</div>';
    html += '</div>';
  }
  container.innerHTML = html;
}

function formatCost(n) {
  if (n < 0.01) return n.toFixed(6);
  if (n < 1) return n.toFixed(4);
  if (n < 100) return n.toFixed(2);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

function switchMode(newMode) {
  mode = newMode;
  var tabs = document.querySelectorAll('.mode-tab');
  for (var i = 0; i < tabs.length && i < 10; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-mode') === newMode);
  }
  document.getElementById('monthly-inputs').style.display = newMode === 'monthly' ? 'block' : 'none';
  document.getElementById('conv-inputs').style.display = newMode === 'conversation' ? 'block' : 'none';
  document.getElementById('selfhost-inputs').style.display = newMode === 'selfhost' ? 'block' : 'none';

  var mainResults = document.querySelector('.results-section:not(#selfhost-results)');
  var shResults = document.getElementById('selfhost-results');
  if (newMode === 'selfhost') {
    if (mainResults) mainResults.style.display = 'none';
    if (shResults) shResults.style.display = 'block';
    calculateSelfHost();
  } else {
    if (mainResults) mainResults.style.display = 'block';
    if (shResults) shResults.style.display = 'none';
    calculate();
  }
}

function bindEvents() {
  // Mode tabs
  var tabs = document.querySelectorAll('.mode-tab');
  for (var i = 0; i < tabs.length && i < 10; i++) {
    tabs[i].addEventListener('click', function() {
      switchMode(this.getAttribute('data-mode'));
    });
  }

  // All inputs
  var inputs = document.querySelectorAll('input[type="number"], input[type="range"], select, input[type="checkbox"]');
  for (var i = 0; i < inputs.length && i < 50; i++) {
    inputs[i].addEventListener('input', function() {
      if (mode === 'selfhost') calculateSelfHost();
      else calculate();
    });
    inputs[i].addEventListener('change', function() {
      if (mode === 'selfhost') calculateSelfHost();
      else calculate();
    });
  }

  // IO ratio display
  var ioSlider = document.getElementById('io-ratio');
  var ioDisplay = document.getElementById('io-display');
  if (ioSlider && ioDisplay) {
    ioSlider.addEventListener('input', function() {
      ioDisplay.textContent = this.value + '% input / ' + (100 - parseInt(this.value, 10)) + '% output';
    });
  }
}

function esc(s) {
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}

/* --- Self-Hosting Break-Even Calculator --- */

var GPU_OPTIONS = [
  { name: "A100 80GB (AWS)", monthlyCost: 3200, tokensPerSec: 40, vram: 80 },
  { name: "H100 80GB (AWS)", monthlyCost: 5400, tokensPerSec: 80, vram: 80 },
  { name: "A100 80GB (Lambda)", monthlyCost: 1800, tokensPerSec: 40, vram: 80 },
  { name: "H100 80GB (Lambda)", monthlyCost: 3000, tokensPerSec: 80, vram: 80 },
  { name: "A10G 24GB (RunPod)", monthlyCost: 450, tokensPerSec: 15, vram: 24 },
  { name: "A100 80GB (RunPod)", monthlyCost: 1400, tokensPerSec: 40, vram: 80 }
];

var SH_MODELS = {
  "llama3-70b": { name: "Llama 3 70B", vramNeeded: 140, apiEquiv: 0.59 },
  "llama3-8b": { name: "Llama 3 8B", vramNeeded: 16, apiEquiv: 0.20 },
  "mistral-7b": { name: "Mistral 7B", vramNeeded: 14, apiEquiv: 0.20 },
  "mixtral-8x22b": { name: "Mixtral 8x22B", vramNeeded: 88, apiEquiv: 1.20 }
};

function calculateSelfHost() {
  var modelKey = document.getElementById('sh-model').value;
  var apiSpend = parseFloat(document.getElementById('sh-api-spend').value) || 500;
  var tokensPerReq = parseInt(document.getElementById('sh-tokens-per-req').value, 10) || 1500;
  var model = SH_MODELS[modelKey];
  if (!model) return;

  var gpuTable = document.getElementById('sh-gpu-table');
  var chartArea = document.getElementById('sh-breakeven-chart');

  // GPU table
  var html = '<table class="results-table"><thead><tr>';
  html += '<th>GPU / Provider</th><th>$/month</th><th>GPUs needed</th><th>Total $/month</th><th>Break-even reqs/mo</th>';
  html += '</tr></thead><tbody>';

  var bestGpu = null;
  var bestCost = Infinity;

  for (var i = 0; i < GPU_OPTIONS.length && i < 20; i++) {
    var gpu = GPU_OPTIONS[i];
    var gpusNeeded = Math.max(1, Math.ceil(model.vramNeeded / gpu.vram));
    var totalMonthlyCost = gpu.monthlyCost * gpusNeeded;
    var costPerReq = (tokensPerReq / 1e6) * model.apiEquiv;
    var breakEvenReqs = costPerReq > 0 ? Math.ceil(totalMonthlyCost / costPerReq) : Infinity;

    if (totalMonthlyCost < bestCost) {
      bestCost = totalMonthlyCost;
      bestGpu = { name: gpu.name, totalCost: totalMonthlyCost, breakEven: breakEvenReqs };
    }

    html += '<tr><td>' + esc(gpu.name) + '</td>';
    html += '<td>$' + formatCost(gpu.monthlyCost) + '</td>';
    html += '<td>' + gpusNeeded + '</td>';
    html += '<td class="cost">$' + formatCost(totalMonthlyCost) + '</td>';
    html += '<td>' + formatNum(breakEvenReqs) + '</td></tr>';
  }
  html += '</tbody></table>';
  gpuTable.innerHTML = html;

  // SVG Break-even chart
  if (!bestGpu) return;
  var svgW = 600, svgH = 300, padL = 60, padR = 20, padT = 20, padB = 40;
  var plotW = svgW - padL - padR, plotH = svgH - padT - padB;

  // X axis: requests per month (0 to 2x break-even)
  var maxReqs = Math.max(bestGpu.breakEven * 2, 10000);
  var costPerReq = (tokensPerReq / 1e6) * model.apiEquiv;
  var maxApiCost = costPerReq * maxReqs;
  var maxY = Math.max(maxApiCost, bestGpu.totalCost * 1.5);

  var points = 50;
  var apiPath = '';
  var hostLine = '';
  var intersectX = -1, intersectY = -1;

  for (var p = 0; p <= points; p++) {
    var reqs = (p / points) * maxReqs;
    var apiCostAtReqs = costPerReq * reqs;
    var x = padL + (reqs / maxReqs) * plotW;
    var yApi = padT + plotH - (apiCostAtReqs / maxY) * plotH;
    apiPath += (p === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + yApi.toFixed(1);

    if (p === 0) {
      var yHost = padT + plotH - (bestGpu.totalCost / maxY) * plotH;
      hostLine = 'M' + padL + ',' + yHost.toFixed(1) + ' L' + (padL + plotW) + ',' + yHost.toFixed(1);
    }
    if (intersectX < 0 && apiCostAtReqs >= bestGpu.totalCost) {
      intersectX = x;
      intersectY = padT + plotH - (bestGpu.totalCost / maxY) * plotH;
    }
  }

  var svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" style="width:100%;max-width:600px;height:auto;" xmlns="http://www.w3.org/2000/svg">';
  // Grid
  svg += '<rect x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '" fill="#111" rx="3"/>';
  // Self-hosted cost line
  svg += '<path d="' + hostLine + '" stroke="#34D399" stroke-width="2" fill="none" stroke-dasharray="6,4"/>';
  // API cost line
  svg += '<path d="' + apiPath + '" stroke="' + '#F43F5E' + '" stroke-width="2" fill="none"/>';
  // Intersection point
  if (intersectX > 0) {
    svg += '<circle cx="' + intersectX.toFixed(1) + '" cy="' + intersectY.toFixed(1) + '" r="5" fill="#FBBF24"/>';
    svg += '<text x="' + (intersectX + 8).toFixed(1) + '" y="' + (intersectY - 8).toFixed(1) + '" fill="#FBBF24" font-size="11" font-family="Space Mono,monospace">Break-even: ' + formatNum(bestGpu.breakEven) + ' reqs/mo</text>';
  }
  // Labels
  svg += '<text x="' + padL + '" y="' + (svgH - 5) + '" fill="#888" font-size="10" font-family="IBM Plex Sans,sans-serif">0</text>';
  svg += '<text x="' + (padL + plotW) + '" y="' + (svgH - 5) + '" fill="#888" font-size="10" text-anchor="end">' + formatNum(maxReqs) + ' reqs</text>';
  svg += '<text x="' + (padL - 5) + '" y="' + (padT + 4) + '" fill="#888" font-size="10" text-anchor="end">$' + formatCost(maxY) + '</text>';
  // Legend
  svg += '<line x1="' + (padL + 10) + '" y1="' + (padT + 12) + '" x2="' + (padL + 30) + '" y2="' + (padT + 12) + '" stroke="#F43F5E" stroke-width="2"/>';
  svg += '<text x="' + (padL + 35) + '" y="' + (padT + 16) + '" fill="#e8e8e8" font-size="10">API Cost</text>';
  svg += '<line x1="' + (padL + 110) + '" y1="' + (padT + 12) + '" x2="' + (padL + 130) + '" y2="' + (padT + 12) + '" stroke="#34D399" stroke-width="2" stroke-dasharray="6,4"/>';
  svg += '<text x="' + (padL + 135) + '" y="' + (padT + 16) + '" fill="#e8e8e8" font-size="10">Self-hosted (' + esc(bestGpu.name) + ')</text>';
  svg += '</svg>';

  var summary = '<p style="font-size:0.9rem;color:var(--text-muted);margin-top:1rem;">';
  summary += 'At your current $' + formatCost(apiSpend) + '/mo spend, ';
  if (apiSpend > bestGpu.totalCost) {
    summary += '<strong style="color:#34D399">self-hosting saves $' + formatCost(apiSpend - bestGpu.totalCost) + '/month</strong> with ' + esc(bestGpu.name) + '.';
  } else {
    summary += '<strong style="color:var(--accent)">API is still cheaper</strong>. You\'d need to spend $' + formatCost(bestGpu.totalCost) + '+/mo on API to justify self-hosting.';
  }
  summary += '</p>';

  chartArea.innerHTML = svg + summary;
}

document.addEventListener('DOMContentLoaded', init);
