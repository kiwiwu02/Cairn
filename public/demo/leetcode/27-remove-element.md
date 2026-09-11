# 27. 移除元素

## 题目要点

给定数组 `nums` 和值 `val`，原地移除所有等于 `val` 的元素，返回剩余元素的数量。

## 思路：快慢指针

慢指针 `write` 指向下一个应该写入有效元素的位置，快指针 `read` 负责扫描整个数组。

```text
for read in [0, n):
    if nums[read] != val:
        nums[write] = nums[read]
        write += 1
return write
```

## 边界检查

- `val` 不存在时，数组长度保持不变。
- 所有元素都等于 `val` 时，返回 `0`。
- 只关心前 `write` 个位置，后面的内容不需要处理。
