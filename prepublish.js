// Handles prepublishing things for cross-platform reasons.
var path = require('path'),
  child_process = require('child_process');

function checkCode(code) {
  if (code != 0) {
    throw new Error("Program exited with code " + code);
  }
}

function getNodeBinItem(name) {
  return path.resolve(".", "node_modules", ".bin", name + (process.platform === "win32" ? ".cmd" : ""));
}

var options = {
  stdio: 'inherit'
}

child_process.spawn(getNodeBinItem('tsd'), ["install"], options)
  .on('close', function(code) {
    checkCode(code);
    child_process.spawn(getNodeBinItem('tsc'), options)
      .on('close', checkCode);
  });
