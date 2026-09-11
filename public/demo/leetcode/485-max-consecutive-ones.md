# 485. 最大连续 1 的个数

## 状态定义

- `current`：以当前位置结尾的连续 `1` 的长度。
- `answer`：扫描到当前位置时出现过的最大长度。

遇到 `1` 时让 `current` 加一，遇到 `0` 时清零，并用 `answer` 保留历史最大值。

```js
let current = 0;
let answer = 0;
for (const value of nums) {
  current = value === 1 ? current + 1 : 0;
  answer = Math.max(answer, current);
}
```

## 复杂度

只需要一次遍历，时间复杂度是 `O(n)`，额外空间复杂度是 `O(1)`。
