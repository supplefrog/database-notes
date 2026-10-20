import assert from 'node:assert/strict';
import {anchorTopic,observeTopic,advanceShape,zeroVelocity} from '../web/design/handbook-lab/contents-glass-math.mjs';
const cases=[];
function check(id,fn){fn();cases.push(id);}
check('own-smooth-travel-retains-click-target',()=>{let o=anchorTopic(5,0,1800,true);o=observeTopic(o,800,true);assert.equal(o.index,5);assert.equal(o.travelling,true);o=observeTopic(o,1800,true);assert.equal(o.kind,'topic');assert.equal(o.travelling,false);});
check('control-contact-without-scroll-retains-settled-pin',()=>{const o=anchorTopic(2,576,576,true);assert.equal(observeTopic(o,576,false).kind,'topic');});
check('native-final-fractional-landing-retains-click-pin',()=>{let o=anchorTopic(5,0,1850.375,true);o=observeTopic(o,1849.6,true);o=observeTopic(o,1850.4,true);assert.equal(o.kind,'topic');assert.equal(o.index,5);assert.equal(observeTopic(o,1851.2,false).kind,'scroll');});
check('manual-movement-releases-during-cancelled-travel',()=>{const o=observeTopic(anchorTopic(5,0,1800,true),800,true);assert.equal(observeTopic(o,720,false).kind,'scroll');});
check('scrollbar-movement-releases-after-authored-trip-settled',()=>{const o=observeTopic(anchorTopic(5,0,1800,true),1800,true);assert.equal(observeTopic(o,1750,true).kind,'scroll');});
check('rapid-new-command-replaces-old-destination',()=>{const old=observeTopic(anchorTopic(5,0,1800,true),700,true);const next=anchorTopic(1,old.position,500,true);assert.equal(observeTopic(next,600,true).index,1);assert.equal(observeTopic(next,500,true).travelling,false);});
check('reduced-motion-and-reversal-preserve-coordinate-contract',()=>{const a={x:0,y:0,w:90,h:36},b={x:8,y:200,w:180,h:60};const first=advanceShape(a,zeroVelocity(),b,1/60);const second=advanceShape(first.shape,first.velocity,a,1/60);assert.notEqual(second.velocity.y,0);const reduced=advanceShape(second.shape,second.velocity,b,1/60,true);assert.deepEqual(reduced.shape,b);assert.deepEqual(reduced.velocity,zeroVelocity());});
console.log(JSON.stringify({status:'pass',cases,scope:'Pure adapter ownership/math cases; actual navigation and rendering require side-browser observations.'},null,2));
