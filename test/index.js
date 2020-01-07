let { MyPromise } = require('../lib/promise');
let promisesAplusTests = require("promises-aplus-tests");

const adapter = {
	deferred: () => {
		let resolve;
		let reject;
		const promise = new MyPromise((res, rej) => { resolve = res; reject = rej; });
		return {
			promise,
			reject,
			resolve,
		};
	}
};

promisesAplusTests(adapter, function (err) {
    console.error('err', err);
});
