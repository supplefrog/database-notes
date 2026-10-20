export function exitIssues(batches){
 const issues=[];let episode=[];const ranges=[];
 const flush=()=>{if(episode.length>=3){const range=Math.max(...episode.map(f=>f.nav.y))-Math.min(...episode.map(f=>f.nav.y));ranges.push(range);if(range>6)issues.push('Visible closing Contents rides the page during reading travel');}episode=[];};
 for(const batch of batches){for(const frame of batch.frames){if(!frame.menu.open&&frame.menu.opacity>.02)episode.push(frame);else flush();}flush();}
 if(!ranges.length)issues.push('No intermediate visible menu exit was observed');
 return {issues:[...new Set(issues)],exitRanges:ranges};
}
export function historyIssues(batches){
 return batches.some(b=>!b.historyStart||!b.historyEnd||b.historyStart.length!==b.historyEnd.length)?['Viewport action adds a Back stop or history evidence is missing']:[];
}
