// Run by tests/child-process.test.ts through tsx: prints the pid of the process that runs this
// file (tsx's inner node process, not the tsx CLI) and stays alive until it is killed.
console.log(process.pid);
setInterval(() => {}, 1000);
