const assert = require('assert');
function round2(n){ return Math.round(n*100)/100; }
function computeBasic(all3, all10, dd, dist){
  const SP1=66.6, SP2=200, MEAL=950, TAXI=dist==='SHORT'?950:2000;
  return round2(all3*SP1 + all10*SP2 + (all3+all10)*MEAL + Math.max(0, all3+all10-dd*2)*TAXI);
}
assert.strictEqual(computeBasic(0,0,0,'SHORT'),0);
assert.strictEqual(computeBasic(1,1,0,'SHORT'),4066.6);
assert.strictEqual(computeBasic(2,2,2,'LONG'),4333.2);
console.log('calc tests passed');
