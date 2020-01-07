# MyPromise

用 `typescript` 根据 Promises/A+ 规范实现 `promise`

> note: 只实现了规范中的功能 finally 等功能未实现

## 测试

已通过 `promises-aplus-tests` 测试
```
npm run test
```

## 声明

只是用于实现规范，为了贴合实际情况用 `queueMicrotask` 推向微任务队列，不保证兼容性。
