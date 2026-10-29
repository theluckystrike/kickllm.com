import subprocess
import sys
from pathlib import Path


source = Path('assets/app.js').read_text(encoding='utf-8-sig')
program = r'''
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(process.argv[1], 'utf8');

function declaration(name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing production function ' + name);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unterminated production function ' + name);
}

const elements = {
  'tokens-per-req': { value: '1000', min: '1', max: '10000000' },
  'reqs-per-day': { value: '-100', min: '1', max: '10000000' },
  'days-per-month': { value: '400', min: '1', max: '31' },
  'io-ratio': { value: '50', min: '10', max: '90' },
  'conv-input-tokens': { value: '2000', min: '1', max: '10000000' },
  'conv-output-tokens': { value: '500', min: '1', max: '10000000' },
  'conv-turns': { value: '-2', min: '1', max: '1000' },
  'sh-model': { value: 'llama3-8b' },
  'sh-api-spend': { value: '-25.5', min: '1', max: '1000000' },
  'sh-tokens-per-req': { value: '-1500', min: '100', max: '100000' },
  'sh-gpu-table': { innerHTML: '' },
  'sh-breakeven-chart': { innerHTML: '' }
};
const context = {
  document: { getElementById: id => elements[id] },
  mode: 'monthly', isFinite, parseInt, parseFloat, Math,
  GPU_OPTIONS: [{ name: 'test GPU', monthlyCost: 100, tokensPerSec: 1, vram: 100 }],
  SH_MODELS: { 'llama3-8b': { name: 'test model', vramNeeded: 10, apiEquiv: 0.2 } },
  esc: s => s, formatCost: n => String(n), formatNum: n => String(n)
};
const functions = ['readInt', 'getInputs', 'calculateSelfHost']
  .filter(name => name !== 'readInt' || source.includes('function readInt('))
  .map(declaration).join('\n');
vm.createContext(context);
vm.runInContext(functions, context);

context.mode = 'monthly';
const monthly = context.getInputs();
if (monthly.reqsPerDay !== 1 || monthly.daysPerMonth !== 31)
  throw new Error('getInputs monthly bounds: expected reqsPerDay=1 and daysPerMonth=31, got ' + JSON.stringify(monthly));
context.mode = 'conversation';
const conversation = context.getInputs();
if (conversation.turns !== 1)
  throw new Error('getInputs conversation bounds: expected turns=1, got ' + JSON.stringify(conversation));
context.calculateSelfHost();
if (!elements['sh-gpu-table'].innerHTML.includes('5000000'))
  throw new Error('calculateSelfHost did not clamp tokens per request to 100');
if (!elements['sh-breakeven-chart'].innerHTML.includes('current $1/mo'))
  throw new Error('calculateSelfHost did not clamp API spend to 1');
console.log('getInputs and calculateSelfHost clamp production inputs to declared bounds');
'''

source_path = sys.argv[1] if len(sys.argv) > 1 else 'assets/app.js'
result = subprocess.run(['node', '-e', program, source_path], text=True, capture_output=True)
if result.stdout:
    print(result.stdout, end='')
if result.stderr:
    print(result.stderr, end='')
raise SystemExit(result.returncode)
