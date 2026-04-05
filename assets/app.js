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
  calculate();
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
    inputs[i].addEventListener('input', calculate);
    inputs[i].addEventListener('change', calculate);
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

document.addEventListener('DOMContentLoaded', init);
