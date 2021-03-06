enum StatesEnum {
    pending = 'pending',
    fulfilled = 'fulfilled',
    rejected = 'rejected'
}

type StateType = keyof typeof StatesEnum;
type onFulfilledType = ((value: any) => any) | null;
type onRejectedType = onFulfilledType;
type generatorKey = 'value' | 'reason';
type generatorFuncition = () => void;
type generatorType = (func: Exclude<onRejectedType | onFulfilledType, null>, key: generatorKey) => generatorFuncition;

/// <reference lib="es2019.Symbol" />
const resolve = Symbol('reslove');
const reject = Symbol('reject');
const Resolve = Symbol('[[Resolve]]');

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
    private onFulfilledQueue: generatorFuncition[] = [];
    private onRejectedQueue: generatorFuncition[] = [];
    constructor(executor: (...arg: ((value?: any) => any)[]) => void) {
        try {
            executor(this[resolve], this[reject]);
        } catch(e) {
            this[resolve](e);
        }
    }
    /** 2.2 一个 promise 必须提供一个 then 方法以访问其当前值、终值和据因。 */
    then(onFulfilled: onFulfilledType, onRejected?: onRejectedType) {
        /** 2.2.7 then 必须返回一个 promise */
        let promise2 = new MyPromise((resolve, reject) => {
            /** 简单封装一下 */
            let generator: generatorType = (func, key) => {
                return () => {
                    queueMicrotask(() => {
                        try {
                            /** 执行时再取值 */
                            let x = func(this[key]);
                            /**
                             * 2.2.7.1 如果 onFulfilled、onRejected 返回一个 x 则执行 [[Resolve]](promise2, x)
                             * 但是这里全都传入了，包括 onFulfilled 不是 function 时的 reslove 调用 也放在了里面
                             * 为了复用代码做的小调整，虽然没有严格按照规范...
                             */
                            MyPromise[Resolve](promise2, x);
                        } catch(e) {
                            /** 2.2.7.2 */
                            reject(e);
                        }
                    });
                }
            }
            /**
             * 2.2.7.3 2.2.7.4
             * 统一处理 onFulfilled onRejected 不是 function 的情况 变成调用 promise2 的 resolve reject
             * reslove 改为 (value: any) => value 交给 [Resolve] 处理，为了处理返回值为 undefinend、null 等情况
             */
            let myFulfilled: Exclude<onFulfilledType, null> = onFulfilled instanceof Function ? onFulfilled : (value: any) => value;
            let myRejected: Exclude<onRejectedType, null> = (onRejected instanceof Function ? onRejected : reject);

            if (this.state === StatesEnum.pending) {
                this.onFulfilledQueue.push(generator(myFulfilled, 'value'));
                this.onRejectedQueue.push(generator(myRejected, 'reason'));
            }

            if (this.state === StatesEnum.fulfilled) generator(myFulfilled, 'value')()

            if (this.state === StatesEnum.rejected) generator(myRejected, 'reason')();
        });

        return promise2;
    }
    /**
     * 2.3 promise 解决过程
     * 处理 promise状态
     */
    static [Resolve](promise: MyPromise, x: any) {
        let called = false; // 防止多次调用
        /** 如果 promise 和 x 指向同一对象，以 TypeError 为据因拒绝执行 promise */
        if (promise === x) return promise[reject](new TypeError('不能返回自己'));

        /** 2.3.2 如果是promise 则使 promise 接受 x 的状态 直接 .then 接收*/
        if (Object.prototype.toString.call(x) === '[object Promise]') return x.then((value: any) => {
            /** 这里 value 也有可能都是 promise */
            MyPromise[Resolve](promise, value);
            /** 保持原promise */
            return value;
        }, (reason: any) => {
            promise[reject](reason);
            return reason;
        });

        /** 2.3.3 */
        if (Object.prototype.toString.call(x) === '[object Object]' || x instanceof Function) {
            try {
                let then = x.then;
                if (Object.prototype.toString.call(then) === '[object Function]') {
                    /** 2.3.3.3.1 如果 resolvePromise 以值 y 为参数被调用，则运行 [[Resolve]](promise, y) */
                    let resolvePromise = (y: any) => {
                        if (called) return;
                        MyPromise[Resolve](promise, y);
                        called = true;
                        return y;
                    };
                    /** 2.3.3.3.2 如果 rejectPromise 以据因 r 为参数被调用，则以据因 r 拒绝 promise */
                    let rejectPromise = (r: any) => {
                        if (called) return;
                        promise[reject](r);
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
    /** catch 就是 then(null, onRejected)的别名 */
    catch(onRejected: onRejectedType) {
        return this.then(null, onRejected);
    }
    /** 
     * 实际上 finally 并不是最后执行，而是不论成功与否都执行
     * 而且不会阻碍数据的流动
     * MyPromise.resolve 是考虑到 callback 返回一个promise 的情况， 调用其 [reslove] 处理过程
     */
    finally(callBack: any) {
        return this.then(
            value => MyPromise.resolve(callBack()).then(() => value),
            reason => MyPromise.resolve(callBack()).then(() => reason)
        )
    }
    static race(list: MyPromise[]) {
        return new MyPromise((reslove, reject) => {
            let done = false;
            list.forEach((promise: MyPromise) => {
                promise.then(
                    res => {
                        !done && reslove(res);
                        done = true;
                    },
                    reason => {
                        !done && reject(reason);
                        done = true;
                    });
            });
        });
    }
    static resolve(value?: any) {
        let promise = new MyPromise((resolve) => { resolve() });
        MyPromise[Resolve](promise, value);
        return promise;
    }
    static reject(reason: any) {
        return new MyPromise((resolve, reject) => {
            reject(reason);
        });
    }
    /** 让 toString 得到 [object Promise] */
    get [Symbol.toStringTag]() {
        return 'Promise';
    }
}

export { MyPromise };
export default MyPromise;
