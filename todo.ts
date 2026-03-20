export function binarySearch(arr: number[], target: number): number {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midVal = arr[mid];

    if (midVal === target) {
      return mid;
    } else if (midVal < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return -1; // not found
}

// Example usage:
// const nums = [1, 3, 5, 7, 9];
// console.log(binarySearch(nums, 5)); // 2
// console.log(binarySearch(nums, 6)); // -1