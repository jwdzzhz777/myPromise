enum StatesEnum {
    pending = 'pending',
    fulfilled = 'fulfilled',
    rejected = 'rejected'
}

type StateType = keyof typeof StatesEnum;
/// <reference lib="es2019.Symbol" />
const resolve = Symbol('reslove');
const reject = Symbol('reject');
const Reslove = Symbol('[[Resolve]]');

class MyPromise {
    /** “value” 是 JavaScript 任意数据类型的值（包括 undefined 、 thenable 或者 promise） */
    private value: any;
    /** "reason" 表明拒绝的值 */
    private reason: any;
    /**
     * 2.1 一个 Promise 的状态必须是 pending、 fulfilled 或者 rejected。
     *
     * 当 Promise 处于 pending 状态：
     *     Promise 可能会转变成 fulfilled 或者 rejected 中的一种。
     * 当 Promise 处于 fulfilled 状态
     *     Promise 状态必须保持不变。
     *     Promise 必须有一个 value，并且它的值不会改变。
     * 当 Promise 处于 rejected 状态
     *     Promise 状态必须保持不变。
     *     Promise 必须有一个 reason，并且它的值不会改变。
     */
    private state: StateType = StatesEnum.pending;
    /**
     * 2.2.6 promise 可以被多次调用 比如:
     * let a = new Promsie(...);
     * a.then();
     * a.then();
     * ...
     */
    private onFulfilledQueue: Function[] = [];
    private onRejectedQueue: Function[] = [];
    constructor(executor: (...arg: Function[]) => void) {
        try {
            executor(this[resolve], this[reject]);
        } catch(e) {
            this[resolve](e);
        }
    }
    /** 2.2 一个 promise 必须提供一个 then 方法以访问其当前值、终值和据因。 */
    then(onFulfilled: Function, onRejected?: Function) {
        /** 2.2.7 then 必须返回一个 promise */
        let promise2 = new MyPromise((resolve, reject) => {
            let generator = (func: Function, value: any): Function => {
                return () => {
                    queueMicrotask(() => {
                        try {
                            let x = func(value);
                            /** 2.2.7.1 如果 onFulfilled、onRejected 返回一个 x 则执行 [[Resolve]](promise2, x) */
                            x && MyPromise[Reslove](promise2, x);
                        } catch(e) {
                            /** 2.2.7.2 */
                            reject(e);
                        }
                    });
                }
            }
            if (this.state === StatesEnum.pending) {
                onFulfilled instanceof Function && this.onFulfilledQueue.push(generator(onFulfilled, this.value));
                onRejected instanceof Function && this.onRejectedQueue.push(generator(onRejected, this.reason));
            }

            if (this.state === StatesEnum.fulfilled) {
                /** 2.2.7.3 如果 onFulfilled 不是函数且 promise1 成功执行， promise2 必须成功执行并返回相同的值 */
                if (!(onFulfilled instanceof Function)) resolve(this.value);
                generator(onFulfilled, this.value)();
            }

            if (this.state === StatesEnum.rejected) {
                /** 2.2.7.4 如果 onRejected 不是函数且 promise1 拒绝执行， promise2 必须拒绝执行并返回相同的据因 */
                if (!(onRejected instanceof Function)) reject(this.reason);
                generator(onRejected as Function, this.reason)();
            }
        });

        return promise2;
    }
    /**
     * 2.3 promise 解决过程
     * 处理 promise状态
     */
    static [Reslove](promise: MyPromise, x: any) {
        let called = false; // 防止多次调用
        /** 如果 promise 和 x 指向同一对象，以 TypeError 为据因拒绝执行 promise */
        if (promise === x) return promise[reject](new TypeError('不能返回自己'));

        /** 2.3.2 如果是promise 则使 promise 接受 x 的状态 直接 .then 接收*/
        if (x.constructor === MyPromise) x.then((value: any) => {
            promise[resolve](value);
            /** 保持原promise */
            return value;
        }, (reason: any) => {
            promise[reject](reason);
            return reason;
        });

        /** 2.3.3 */
        if (x instanceof Object || x instanceof Function) {
            try {
                let then = x.then;
                if (then instanceof Function) {
                    /** 2.3.3.3.1 如果 resolvePromise 以值 y 为参数被调用，则运行 [[Resolve]](promise, y) */
                    let resolvePromise = (y: any) => {
                        !called && this[Reslove](promise, x);
                        called = true;
                        return y;
                    };
                    /** 2.3.3.3.2 如果 rejectPromise 以据因 r 为参数被调用，则以据因 r 拒绝 promise */
                    let rejectPromise = (r: any) => {
                        !called && promise[reject](r);
                        called = true;
                        return r;
                    };

                    /**
                     * 2.3.3.3 如果 then 是函数，将 x 作为函数的作用域 this 调用之。传递两个回调函数作为参数，第一个参数叫做 resolvePromise ，第二个参数叫做 rejectPromise:
                     * called:
                     *      2.3.3.3.3 如果 resolvePromise 和 rejectPromise 均被调用，或者被同一参数调用了多次，则优先采用首次调用并忽略剩下的调用
                     */
                    then.call(x, resolvePromise, rejectPromise);
                } else {
                    /** 2.3.3.4 如果 then 不是函数，以 x 为参数执行 promise */
                    promise[resolve](x);
                }
            } catch(e) {
                /** 2.3.3.3.4 如果 resolvePromise 或 rejectPromise 已经被调用，则忽略之 */
                !called && promise[reject](e);
            }
        } else {
            /** 2.3.4 如果 x 不为对象或者函数，以 x 为参数执行 promise */
            promise[resolve](x);
        }
    }
    /**
     * 构造函数中作为参数返回的 resolve 方法
     * 箭头函数防止 函数提取调用时 this 问题
     * Symbol 防止外部调用
     * 可以内部调用方便 Promise 解决过程
     */
    [resolve] = (value: any) => {
        this.state = StatesEnum.fulfilled;
        this.value = value;

        this.onFulfilledQueue.forEach(fn => void fn());
    }
    /**
     * 构造函数中作为参数返回的 reject 方法
     * 同 [resolve]
     */
    [reject] = (reason: any) => {
        this.state = StatesEnum.rejected;
        this.reason = reason;

        this.onRejectedQueue.forEach(fn => void fn());
    }
    static resolve() {}
    static reject(err: any) {}
    get [Symbol.toStringTag]() {
        return 'Promise';
    }
}


let a = new MyPromise((resolve) => {
    resolve(1);
});
a.then((x: any) => console.log(x));
export { MyPromise };
export default MyPromise;
